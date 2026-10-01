// Cloudinary adapter. Everything server-side talks to Cloudinary through CloudPort, so services are unit-testable
// with a fake (test/fake-cloud.ts) and no test can ever reach the network.
import { v2 as cloudinary } from "cloudinary";
import { getConfig, type Config } from "./config";

export type Asset = {
  publicId: string;
  assetId?: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  tags: string[];
  context: Record<string, string>;
};

export type GenAsset = { publicId: string; assetId: string; width: number; height: number; modelId: string; seed: number };
export type GenResult = { status: "pending" | "done" | "failed"; taskId?: string; assets?: GenAsset[]; error?: string; quotaRemaining?: number; usedByRequest?: number };

export interface CloudPort {
  cloud: string;
  signUpload(params: Record<string, string | number>): { signature: string; timestamp: number; apiKey: string };
  uploadFromUrl(url: string, opts: UploadOpts): Promise<Asset>;
  uploadBuffer(buf: Buffer, opts: UploadOpts): Promise<Asset>;
  createIfAbsent(publicId: string, tags: string[]): Promise<"created" | "existing">;
  listPrefix(prefix: string, type: "raw" | "image"): Promise<string[]>;
  listTag(tag: string): Promise<Asset[]>;
  getResource(publicId: string, type?: "image" | "raw"): Promise<Asset | null>;
  update(publicId: string, opts: { tags?: string[]; context?: Record<string, string>; metadata?: Record<string, string> }, type?: "image" | "raw"): Promise<void>;
  destroy(publicId: string, type?: "image" | "raw"): Promise<void>;
  deleteByTag(tag: string, type?: "image" | "raw"): Promise<number>;
  usage(): Promise<{ creditsUsed: number; creditsLimit: number; plan: string }>;
  fetchBuffer(url: string): Promise<{ status: number; buf: Buffer; error?: string }>;
  generate(kind: "text_to_image" | "image_to_image", body: Record<string, unknown>): Promise<GenResult>;
  task(taskId: string): Promise<GenResult>;
}

export type UploadOpts = { publicId: string; tags?: string[]; context?: Record<string, string>; overwrite?: boolean };

const toAsset = (r: any): Asset => ({
  publicId: r.public_id,
  assetId: r.asset_id,
  width: r.width ?? 0,
  height: r.height ?? 0,
  bytes: r.bytes ?? 0,
  format: r.format ?? "",
  tags: r.tags ?? [],
  context: r.context?.custom ?? r.context ?? {},
});

// Generation API (docs: cloudinary.com/documentation/image_generation_addon). Defensive parsing: sync responses put
// assets under data.assets, async task results under data.result.
export function parseGen(json: any): GenResult {
  const data = json?.data ?? {};
  const result = data.result ?? data;
  const rawAssets: any[] = result?.assets ?? result?.data?.assets ?? [];
  const limits = json?.limits ?? result?.limits ?? data?.limits;
  const quota = Array.isArray(limits?.addons_quota) ? limits.addons_quota[0] : undefined;
  const assets = rawAssets.map((a) => ({
    publicId: a.storage?.public_id ?? a.public_id,
    assetId: a.storage?.asset_id ?? a.asset_id,
    width: a.width,
    height: a.height,
    modelId: a.model?.id ?? "unknown",
    seed: a.seed ?? 0,
  }));
  const status = String(data.status ?? (assets.length ? "completed" : "pending")).toLowerCase();
  return {
    status: assets.length ? "done" : /fail|error/.test(status) ? "failed" : "pending",
    taskId: data.task_id,
    assets: assets.length ? assets : undefined,
    error: data.error?.message ?? json?.error?.message,
    quotaRemaining: typeof quota?.remaining === "number" ? quota.remaining : undefined,
    usedByRequest: typeof quota?.used_by_request === "number" ? quota.used_by_request : undefined,
  };
}

export function createCloud(cfg: Config = getConfig()): CloudPort {
  cloudinary.config({ cloud_name: cfg.cloud, api_key: cfg.apiKey, api_secret: cfg.apiSecret, secure: true });
  const basic = "Basic " + Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");
  const genBase = `https://api.cloudinary.com/v2/generate/${cfg.cloud}`;

  const upload = (file: string, opts: UploadOpts, resourceType: "image" | "raw" = "image") =>
    cloudinary.uploader.upload(file, {
      public_id: opts.publicId,
      tags: opts.tags,
      context: opts.context,
      overwrite: opts.overwrite ?? false,
      resource_type: resourceType,
    });

  return {
    cloud: cfg.cloud,
    signUpload(params) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = cloudinary.utils.api_sign_request({ ...params, timestamp }, cfg.apiSecret);
      return { signature, timestamp, apiKey: cfg.apiKey };
    },
    async uploadFromUrl(url, opts) {
      // Derived URLs can answer 423 (still processing) on first request: retry with backoff.
      let lastErr: unknown;
      for (let i = 0; i < 6; i++) {
        try {
          return toAsset(await upload(url, opts));
        } catch (e: any) {
          lastErr = e;
          const code = e?.http_code ?? e?.error?.http_code;
          const msg = String(e?.message ?? e?.error?.message ?? "");
          if (code === 420 || code === 423 || /423|processing/i.test(msg)) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          throw e;
        }
      }
      throw lastErr;
    },
    async uploadBuffer(buf, opts) {
      return toAsset(await upload(`data:image/png;base64,${buf.toString("base64")}`, opts));
    },
    async createIfAbsent(publicId, tags) {
      const r: any = await upload("data:text/plain;base64,MQ==", { publicId, tags, overwrite: false }, "raw");
      return r.existing ? "existing" : "created";
    },
    async listPrefix(prefix, type) {
      const out: string[] = [];
      let next: string | undefined;
      do {
        const r: any = await cloudinary.api.resources({ type: "upload", resource_type: type, prefix, max_results: 500, next_cursor: next });
        out.push(...r.resources.map((x: any) => x.public_id));
        next = r.next_cursor;
      } while (next);
      return out;
    },
    async listTag(tag) {
      const r: any = await cloudinary.api.resources_by_tag(tag, { max_results: 500, context: true, tags: true });
      return r.resources.map(toAsset);
    },
    async getResource(publicId, type = "image") {
      try {
        return toAsset(await cloudinary.api.resource(publicId, { resource_type: type, context: true, tags: true }));
      } catch (e: any) {
        if (e?.error?.http_code === 404 || e?.http_code === 404) return null;
        throw e;
      }
    },
    async update(publicId, opts, type = "image") {
      const ctx = opts.context ? Object.entries(opts.context).map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, " ")}`).join("|") : undefined;
      const metadata = opts.metadata ? Object.entries(opts.metadata).map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, " ")}`).join("|") : undefined;
      await cloudinary.api.update(publicId, { resource_type: type, tags: opts.tags, context: ctx, metadata } as any);
    },
    async destroy(publicId, type = "image") {
      await cloudinary.uploader.destroy(publicId, { resource_type: type, invalidate: true });
    },
    async deleteByTag(tag, type = "image") {
      const r: any = await cloudinary.api.delete_resources_by_tag(tag, { resource_type: type, invalidate: true });
      return Object.keys(r.deleted ?? {}).length;
    },
    async usage() {
      const u: any = await cloudinary.api.usage();
      return { creditsUsed: u.credits?.usage ?? 0, creditsLimit: u.credits?.limit ?? 25, plan: u.plan ?? "unknown" };
    },
    async fetchBuffer(url) {
      const res = await fetch(url);
      return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), error: res.headers.get("x-cld-error") ?? undefined };
    },
    async generate(kind, body) {
      const res = await fetch(`${genBase}/${kind}`, {
        method: "POST",
        headers: { Authorization: basic, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      const parsed = parseGen(json);
      if (!res.ok && res.status !== 202) return { ...parsed, status: "failed", error: parsed.error ?? `HTTP ${res.status}` };
      return parsed;
    },
    async task(taskId) {
      const res = await fetch(`${genBase}/tasks/${encodeURIComponent(taskId)}`, { headers: { Authorization: basic } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { status: "failed", error: json?.error?.message ?? `HTTP ${res.status}` };
      return parseGen(json);
    },
  };
}

let singleton: CloudPort | null = null;
export function cloud(): CloudPort {
  return (singleton ??= createCloud());
}
