// In-memory CloudPort for tests. createIfAbsent is atomic by construction (single-threaded map check+set),
// mirroring the guarantee free check #6 verifies on the real account.
import type { Asset, CloudPort, GenResult, UploadOpts } from "@/lib/cloud";

export type FakeCloud = CloudPort & {
  assets: Map<string, Asset>;
  raw: Set<string>;
  fetches: string[];
  buffers: Map<string, { status: number; buf: Buffer }>;
  generated: Array<{ kind: string; body: Record<string, unknown> }>;
  failListing: boolean;
  usageCredits: number;
};

export function fakeCloud(seed: Asset[] = []): FakeCloud {
  const assets = new Map(seed.map((a) => [a.publicId, a]));
  const raw = new Set<string>();
  const rawMeta = new Map<string, Record<string, string>>();
  const f: FakeCloud = {
    cloud: "testcloud",
    assets,
    raw,
    fetches: [],
    buffers: new Map(),
    generated: [],
    failListing: false,
    usageCredits: 1,
    signUpload: (params) => ({ signature: `sig(${Object.keys(params).sort().join(",")})`, timestamp: 1700000000, apiKey: "111" }),
    async uploadFromUrl(url: string, o: UploadOpts) {
      if (assets.has(o.publicId) && o.overwrite === false) return assets.get(o.publicId)!;
      const a: Asset = { publicId: o.publicId, assetId: `aid-${o.publicId}`, width: 1024, height: 1024, bytes: 1000, format: "jpg", tags: o.tags ?? [], context: { src: url } };
      assets.set(o.publicId, a);
      return a;
    },
    async uploadBuffer(_b: Buffer, o: UploadOpts) {
      const a: Asset = { publicId: o.publicId, width: 100, height: 100, bytes: 10, format: "png", tags: o.tags ?? [], context: {} };
      assets.set(o.publicId, a);
      return a;
    },
    async createIfAbsent(id: string) {
      if (raw.has(id)) return "existing";
      raw.add(id);
      return "created";
    },
    async listPrefix(prefix: string, type: "raw" | "image") {
      if (f.failListing) throw new Error("admin api down");
      return [...(type === "raw" ? raw : assets.keys())].filter((k) => k.startsWith(prefix));
    },
    async listTag(tag: string) {
      if (f.failListing) throw new Error("admin api down");
      return [...assets.values()].filter((a) => a.tags.includes(tag));
    },
    async getResource(id: string, type = "image") {
      if (type === "raw") return raw.has(id) ? { publicId: id, width: 0, height: 0, bytes: 1, format: "txt", tags: [], context: rawMeta.get(id) ?? {} } : null;
      return assets.get(id) ?? null;
    },
    async update(id: string, o, type = "image") {
      if (type === "raw") { if (raw.has(id) && o.context) rawMeta.set(id, { ...rawMeta.get(id), ...o.context }); return; }
      const a = assets.get(id);
      if (!a) return;
      if (o.tags) a.tags = [...new Set([...a.tags, ...o.tags])];
      if (o.context) a.context = { ...a.context, ...o.context };
    },
    async destroy(id: string) {
      assets.delete(id);
    },
    async deleteByTag(tag: string) {
      let n = 0;
      for (const [k, a] of assets) if (a.tags.includes(tag)) { assets.delete(k); n++; }
      return n;
    },
    async usage() {
      return { creditsUsed: f.usageCredits, creditsLimit: 25, plan: "Free" };
    },
    async fetchBuffer(url: string) {
      f.fetches.push(url);
      for (const [needle, v] of f.buffers) if (url.includes(needle)) return v;
      return { status: 404, buf: Buffer.alloc(0) };
    },
    async generate(kind, body): Promise<GenResult> {
      f.generated.push({ kind, body });
      return { status: "pending", taskId: `t${f.generated.length}` };
    },
    async task(): Promise<GenResult> {
      return { status: "pending" };
    },
  };
  return f;
}

export const asset = (publicId: string, extra: Partial<Asset> = {}): Asset => ({
  publicId, width: 1024, height: 1024, bytes: 500_000, format: "jpg", tags: [], context: {}, ...extra,
});
