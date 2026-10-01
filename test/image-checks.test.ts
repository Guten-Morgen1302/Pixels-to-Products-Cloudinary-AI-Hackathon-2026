import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { alignmentScore, cutoutCoverage, makeCore, ncc, whiteCheck } from "@/lib/image-checks";

// Synthetic product: 200×200 opaque "jar" with a striped label (internal edges), transparent elsewhere.
async function productPng(size = 200): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect x="40" y="20" width="120" height="170" rx="10" fill="#7a5230"/>
    ${[50, 80, 110, 140].map((y) => `<rect x="50" y="${y}" width="100" height="10" fill="#f2e3c6"/>`).join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function scene(place: { x: number; y: number }, product: Buffer, brightness = 1): Promise<Buffer> {
  const bg = await sharp({ create: { width: 512, height: 512, channels: 3, background: { r: 120, g: 128, b: 135 } } }).png().toBuffer();
  const out = await sharp(bg).composite([{ input: product, left: place.x, top: place.y }]).png().toBuffer();
  return brightness === 1 ? out : sharp(out).modulate({ brightness }).png().toBuffer();
}

describe("cutoutCoverage", () => {
  it("measures opaque pixels against the original frame", async () => {
    const p = await productPng();
    const c = await cutoutCoverage(p, 200, 200);
    expect(c).toBeGreaterThan(0.45);
    expect(c).toBeLessThan(0.55);
    expect(await cutoutCoverage(p, 2000, 2000)).toBeLessThan(0.01); // tiny product in a big frame -> rejected
  });
});

describe("makeCore", () => {
  it("keeps pixel dimensions identical and shrinks the opaque area", async () => {
    const p = await productPng();
    const core = await makeCore(p);
    const [a, b] = await Promise.all([sharp(p).metadata(), sharp(core).metadata()]);
    expect([b.width, b.height]).toEqual([a.width, a.height]);
    expect(await cutoutCoverage(core, 200, 200)).toBeLessThan(await cutoutCoverage(p, 200, 200));
  });
});

describe("alignmentScore", () => {
  const stage = { w: 512, h: 512 };
  const place = { x: 156, y: 156, w: 200, h: 200 };

  it("relit-but-aligned passes, an 8px shift fails", async () => {
    const p = await productPng();
    const comp = await scene({ x: 156, y: 156 }, p);
    const relit = await scene({ x: 156, y: 156 }, p, 1.25);
    const shifted = await scene({ x: 164, y: 160 }, p, 1.25);
    const good = await alignmentScore(comp, relit, p, stage, place);
    const bad = await alignmentScore(comp, shifted, p, stage, place);
    expect(good).toBeGreaterThan(0.9);
    expect(bad).toBeLessThan(good - 0.3);
  });

  it("ncc of identical signals is 1", () => {
    const a = Float32Array.from([1, 5, 2, 8, 3, 9, 4, 7, 6, 2, 1, 5, 3, 3, 8, 1, 9]);
    expect(ncc(a, a)).toBeCloseTo(1, 6);
  });
});

describe("whiteCheck", () => {
  async function amazon(fill: { r: number; g: number; b: number }) {
    const p = await productPng();
    const prod = await sharp(p).resize(1700, 1700).toBuffer();
    return sharp({ create: { width: 2000, height: 2000, channels: 3, background: fill } })
      .composite([{ input: prod, left: 150, top: 150 }])
      .jpeg({ quality: 95 })
      .toBuffer();
  }
  it("passes pure white and fails off-white", async () => {
    const p = await productPng();
    expect((await whiteCheck(await amazon({ r: 255, g: 255, b: 255 }), p)).ok).toBe(true);
    const off = await whiteCheck(await amazon({ r: 250, g: 250, b: 250 }), p);
    expect(off.ok).toBe(false);
    expect(off.minValue).toBeLessThan(254);
  });
});
