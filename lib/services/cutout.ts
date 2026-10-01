import { randomUUID } from "node:crypto";
import type { CloudPort } from "../cloud";
import type { Config } from "../config";
import { reserveCutout, reserveUpload } from "../budget";
import { cutoutCoverage, makeCore } from "../image-checks";
import { expTag, ownsAsset, sessionFolder } from "../session";
import { cutoutSourceUrl, deliveryUrl, type CutRef } from "../urls";
import { AppError, MESSAGES } from "./errors";

export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_FORMATS = "jpg,jpeg,png,webp,heic,heif";
const INCOMING = "c_limit,w_2400,h_2400,q_auto:good"; // caps stored originals at ~1 MB (X6)

// Signed direct browser -> Cloudinary upload: one server-chosen public_id, overwrite:false (X6, E1).
export async function signUpload(port: CloudPort, cfg: Config, sessionId: string, visitor: string) {
  const r = await reserveUpload(port, cfg, visitor);
  if (!r.ok) throw new AppError("BUDGET_PAUSED", "Uploads paused for today. Try a sample.", 503);
  const params = {
    public_id: `${sessionFolder(sessionId)}/${randomUUID().slice(0, 12)}`,
    overwrite: "false",
    tags: `realstage,session-${sessionId},${expTag()}`,
    allowed_formats: ALLOWED_FORMATS,
    transformation: INCOMING,
  };
  const { signature, timestamp, apiKey } = port.signUpload(params);
  return { cloudName: port.cloud, apiKey, timestamp, signature, ...params };
}

export type CutoutResult = { original: { publicId: string; w: number; h: number }; cut: CutRef; coreId: string; coverage: number };

// Materialize the canonical cutout as its own asset, check coverage, derive the Pixel-Lock core.
export async function makeCutout(port: CloudPort, sessionId: string, originalId: string, visitor: string): Promise<CutoutResult> {
  if (!ownsAsset(sessionId, originalId)) throw new AppError("FORBIDDEN", MESSAGES.FORBIDDEN, 403);
  const original = await port.getResource(originalId);
  if (!original) throw new AppError("NOT_FOUND", MESSAGES.NOT_FOUND, 404);
  if (original.bytes > MAX_BYTES) {
    await port.destroy(originalId).catch(() => undefined);
    throw new AppError("TOO_LARGE", MESSAGES.TOO_LARGE, 413);
  }
  const isSample = originalId.startsWith("realstage/samples/");
  const cutId = `${originalId}_cut`;
  const coreId = `${originalId}_core`;

  // Samples are pre-cut by scripts/setup.ts: zero cutout budget (DR1).
  const existingCut = await port.getResource(cutId);
  const existingCore = existingCut ? await port.getResource(coreId) : null;
  if (existingCut && existingCore) {
    return {
      original: { publicId: originalId, w: original.width, h: original.height },
      cut: { publicId: cutId, w: existingCut.width, h: existingCut.height },
      coreId,
      coverage: Number(existingCut.context?.rs_coverage ?? 0.3),
    };
  }
  if (isSample) throw new AppError("NOT_FOUND", "This sample isn't ready yet.", 404);

  // Reserve once per photo: client retries on PROCESSING must not burn extra cutout slots.
  if (original.context?.rs_cut_paid !== "1") {
    const reserved = await reserveCutout(port, visitor);
    if (!reserved.ok) throw new AppError("BUDGET_PAUSED", "Uploads paused for today. Try a sample.", 503);
    await port.update(originalId, { context: { rs_cut_paid: "1" } });
  }

  const tags = ["realstage", `session-${sessionId}`, expTag()];
  let cut;
  try {
    cut = await port.uploadFromUrl(cutoutSourceUrl(port.cloud, originalId), { publicId: cutId, tags });
  } catch (e: any) {
    const msg = String(e?.message ?? e?.error?.message ?? "");
    if (/423|processing/i.test(msg)) throw new AppError("PROCESSING", MESSAGES.PROCESSING, 503);
    throw new AppError("INTERNAL", MESSAGES.INTERNAL, 502);
  }
  const png = await port.fetchBuffer(deliveryUrl(port.cloud, cutId, ["f_png"]));
  if (png.status !== 200) throw new AppError("PROCESSING", MESSAGES.PROCESSING, 503);

  const coverage = await cutoutCoverage(png.buf, original.width, original.height);
  if (coverage < 0.01 || coverage > 0.98) {
    await port.destroy(cutId).catch(() => undefined);
    throw new AppError("NO_PRODUCT", MESSAGES.NO_PRODUCT, 422);
  }
  await port.update(cutId, { context: { rs_coverage: coverage.toFixed(4) } }).catch(() => undefined);
  await port.uploadBuffer(await makeCore(png.buf), { publicId: coreId, tags });
  return {
    original: { publicId: originalId, w: original.width, h: original.height },
    cut: { publicId: cutId, w: cut.width, h: cut.height },
    coreId,
    coverage,
  };
}
