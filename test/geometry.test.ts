import { describe, expect, it } from "vitest";
import { cropWindow, isValidGeometry, placeProduct, shadowBox } from "@/lib/geometry";

const G = { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 };
const S = { w: 1024, h: 1024 };

describe("placeProduct", () => {
  it.each([
    ["tall product is height-limited", { w: 300, h: 900 }, { x: 410, y: 205, w: 205, h: 614 }],
    ["wide product is width-limited", { w: 1200, h: 400 }, { x: 256, y: 648, w: 512, h: 171 }],
    ["square product", { w: 500, h: 500 }, { x: 256, y: 307, w: 512, h: 512 }],
  ])("%s", (_n, cut, expected) => {
    expect(placeProduct(S, cut, G)).toEqual(expected);
  });

  it("puts the product's bottom on the floor line and inside the max box", () => {
    const p = placeProduct(S, { w: 333, h: 777 }, G);
    expect(p.y + p.h).toBe(Math.round(0.8 * 1024));
    expect(p.w).toBeLessThanOrEqual(0.5 * 1024 + 1);
    expect(p.h).toBeLessThanOrEqual(0.6 * 1024 + 1);
  });

  it("rejects a zero-size cut", () => {
    expect(() => placeProduct(S, { w: 0, h: 10 }, G)).toThrow();
  });
});

describe("cropWindow", () => {
  it("centres a 9:16 crop on the anchor and keeps it inside the frame", () => {
    expect(cropWindow({ w: 2048, h: 2048 }, 9 / 16, 0.5)).toEqual({ x: 448, y: 0, w: 1152, h: 2048 });
  });
  it("clamps at the left and right edges", () => {
    expect(cropWindow({ w: 2048, h: 2048 }, 9 / 16, 0.05).x).toBe(0);
    const r = cropWindow({ w: 2048, h: 2048 }, 9 / 16, 0.98);
    expect(r.x + r.w).toBe(2048);
  });
  it("4:5 and 1:1", () => {
    expect(cropWindow({ w: 2048, h: 2048 }, 4 / 5, 0.5)).toEqual({ x: 205, y: 0, w: 1638, h: 2048 });
    expect(cropWindow({ w: 2048, h: 2048 }, 1, 0.5)).toEqual({ x: 0, y: 0, w: 2048, h: 2048 });
  });
});

describe("geometry rules", () => {
  it("enforces max_w/2 <= anchorX <= 1 - max_w/2 (R2-21)", () => {
    expect(isValidGeometry(G)).toBe(true);
    expect(isValidGeometry({ ...G, anchorX: 0.2 })).toBe(false);
    expect(isValidGeometry({ ...G, maxW: 0 })).toBe(false);
  });
  it("shadow sits centred under the product, 1.1x wide", () => {
    const p = placeProduct(S, { w: 500, h: 500 }, G);
    const s = shadowBox(p, S);
    expect(s.w).toBe(Math.round(p.w * 1.1));
    expect(Math.abs(s.x + s.w / 2 - (p.x + p.w / 2))).toBeLessThanOrEqual(1);
  });
});
