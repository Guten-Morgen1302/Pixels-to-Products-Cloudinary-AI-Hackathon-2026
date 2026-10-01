// The three small sharp steps that run on Vercel (Eng R2-15): cutout coverage, Pixel-Lock core, alignment, Amazon white.
import sharp from "sharp";
import type { Box } from "./geometry";

// Grayscale or gray+alpha PNGs (black-and-white products) would break channel indexing below.
export async function rgba(buf: Buffer): Promise<Buffer> {
  return sharp(buf).toColourspace("srgb").ensureAlpha().png().toBuffer();
}

// Opaque-pixel coverage of the trimmed cutout against the ORIGINAL frame (Round 3, R3-1: trim doesn't change the count).
export async function cutoutCoverage(cutPngIn: Buffer, originalW: number, originalH: number): Promise<number> {
  const cutPng = await rgba(cutPngIn);
  const { data, info } = await sharp(cutPng).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > 127) opaque++;
  if (info.width * info.height === 0) return 0;
  return opaque / (originalW * originalH);
}

// _core: alpha eroded ~2px and feathered 1px, same pixel dimensions as _cut (Eng E7 R2-1, edge handling).
export async function makeCore(cutPngIn: Buffer): Promise<Buffer> {
  const cutPng = await rgba(cutPngIn);
  const { width, height } = await sharp(cutPng).metadata();
  const rgb = await sharp(cutPng).removeAlpha().raw().toBuffer();
  const eroded = await sharp(cutPng).ensureAlpha().extractChannel(3).blur(1.5).threshold(250).blur(0.6).raw().toBuffer();
  return sharp(rgb, { raw: { width: width!, height: height!, channels: 3 } })
    .joinChannel(eroded, { raw: { width: width!, height: height!, channels: 1 } })
    .png()
    .toBuffer();
}

async function grayRegion(img: Buffer, region: Box, size: { w: number; h: number }, scale: number): Promise<Float32Array> {
  // sharp applies one resize per pipeline, so normalise to stage size first, then extract + downscale.
  const normalised = await sharp(img).resize(size.w, size.h, { fit: "fill" }).toBuffer();
  const out = await sharp(normalised)
    .extract({ left: region.x, top: region.y, width: region.w, height: region.h })
    .resize(Math.max(8, Math.round(region.w * scale)), Math.max(8, Math.round(region.h * scale)), { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  return Float32Array.from(out);
}

function sobel(g: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      out[i] = Math.hypot(gx, gy);
    }
  return out;
}

export function ncc(a: Float32Array, b: Float32Array, mask?: Uint8Array): number {
  let n = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) if (!mask || mask[i]) { n++; sa += a[i]; sb += b[i]; }
  if (n < 16) return 0;
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++)
    if (!mask || mask[i]) {
      const x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
  return da === 0 || db === 0 ? (da === db ? 1 : 0) : num / Math.sqrt(da * db);
}

// Pixel-Lock gate (Eng E3): Sobel edge-map NCC inside the cutout mask eroded 4px, product box only, ≤512px.
// Internal edges (labels, rims, weave) move when AI shifts the product, but survive relighting.
export async function alignmentScore(composite: Buffer, relit: Buffer, cutPngIn: Buffer, stage: { w: number; h: number }, place: Box): Promise<number> {
  const cutPng = await rgba(cutPngIn);
  const scale = Math.min(1, 512 / Math.max(place.w, place.h));
  const w = Math.max(8, Math.round(place.w * scale));
  const h = Math.max(8, Math.round(place.h * scale));
  const [a, b] = await Promise.all([grayRegion(composite, place, stage, scale), grayRegion(relit, place, stage, scale)]);
  const maskRaw = await sharp(cutPng).ensureAlpha().extractChannel(3).resize(w, h, { fit: "fill" }).blur(2.5).threshold(250).raw().toBuffer();
  const mask = Uint8Array.from(maskRaw, (v) => (v > 0 ? 1 : 0));
  return ncc(sobel(a, w, h), sobel(b, w, h), mask);
}

// Amazon main: every background pixel ≥254 (JPEG-safe white). Background = outer padding band plus pixels that are
// transparent in the cutout and at least ~16px away from the product (JPEG 4:2:0 chroma blocks are 16px, so colour ringing reaches that far; Eng R2-22).
export async function whiteCheck(amazonJpg: Buffer, cutPngIn: Buffer): Promise<{ ok: boolean; minValue: number; checked: number }> {
  const cutPng = await rgba(cutPngIn);
  const { data, info } = await sharp(amazonJpg).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const meta = await sharp(cutPng).metadata();
  const s = Math.min(1700 / meta.width!, 1700 / meta.height!);
  const fw = Math.round(meta.width! * s), fh = Math.round(meta.height! * s);
  const ox = Math.round((W - fw) / 2), oy = Math.round((H - fh) / 2);
  const alpha = await sharp(cutPng).ensureAlpha().extractChannel(3).resize(fw, fh, { fit: "fill" }).blur(11).raw().toBuffer();
  let min = 255, checked = 0;
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const ix = x - ox, iy = y - oy;
      const inside = ix >= 0 && iy >= 0 && ix < fw && iy < fh;
      if (inside && alpha[iy * fw + ix] > 2) continue; // product or its ~16px halo zone
      const p = (y * W + x) * ch;
      const v = ch >= 3 ? Math.min(data[p], data[p + 1], data[p + 2]) : data[p];
      if (v < min) min = v;
      checked++;
    }
  return { ok: min >= 254, minValue: min, checked };
}
