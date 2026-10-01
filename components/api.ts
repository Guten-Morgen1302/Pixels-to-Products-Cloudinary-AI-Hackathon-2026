"use client";

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const FALLBACK = "Something went wrong on our side. Try again.";

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("NETWORK", "You're offline or the connection dropped. Try again.");
  }
  const json = await res.json().catch(() => ({ ok: false, code: "INTERNAL", message: FALLBACK }));
  if (!json.ok) throw new ApiError(json.code ?? "INTERNAL", json.message ?? FALLBACK);
  return json as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Poll until `step` returns a value, or time out (generation: 90 s UI timeout, Eng async handling).
type PollOpts = { every?: number; timeout?: number; cancelled?: () => boolean };
export async function poll<T>(step: () => Promise<T | null>, { every = 2000, timeout = 90_000, cancelled = () => false }: PollOpts = {}): Promise<T> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (cancelled()) throw new ApiError("CANCELLED", "");
    const v = await step();
    if (v !== null) return v;
    await sleep(every);
  }
  throw new ApiError("GEN_TIMEOUT", "This model didn't respond.");
}

// Direct signed upload to Cloudinary with progress (E1: bypasses Vercel's 4.5 MB body limit).
export function uploadToCloudinary(file: File, signed: Record<string, string | number>, onProgress: (pct: number) => void): Promise<{ public_id: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const k of ["api_key", "timestamp", "signature", "public_id", "overwrite", "tags", "allowed_formats", "transformation"]) {
      const key = k === "api_key" ? "apiKey" : k;
      if (signed[key] !== undefined) form.append(k, String(signed[key]));
    }
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let json: any = {};
      try {
        json = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status === 200) resolve(json);
      else if (/format|invalid image/i.test(json?.error?.message ?? "")) reject(new ApiError("NOT_A_PHOTO", "That file isn't a photo."));
      else if (/size|too large/i.test(json?.error?.message ?? "")) reject(new ApiError("TOO_LARGE", "Photos up to 10 MB, please."));
      else reject(new ApiError("UPLOAD", "Upload failed. Try again."));
    };
    xhr.onerror = () => reject(new ApiError("NETWORK", "You're offline or the connection dropped. Try again."));
    xhr.send(form);
  });
}
