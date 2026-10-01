// Placement and crop math. One owner for every x/y/w/h used by composites, Pixel-Lock overlay,
// alignment masks and kit crops (Eng review: Code quality P2; R2-1, R2-21).
//
//   stage (W×H)
//   +--------------------------------+
//   |                                |
//   |        +-----max box-----+     |   product scaled to fit inside maxW·W × maxH·H,
//   |        |    [product]    |     |   bottom edge on floorY·H, centred on anchorX·W
//   |  ======|=====floor=======|==== |
//   +--------------------------------+

export type Geometry = { anchorX: number; floorY: number; maxW: number; maxH: number };
export type Box = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function isValidGeometry(g: Geometry): boolean {
  const inUnit = [g.anchorX, g.floorY, g.maxW, g.maxH].every((v) => Number.isFinite(v) && v > 0 && v <= 1);
  return inUnit && g.anchorX >= g.maxW / 2 && g.anchorX <= 1 - g.maxW / 2 && g.floorY >= g.maxH;
}

export function placeProduct(stage: Size, cut: Size, g: Geometry): Box {
  if (cut.w <= 0 || cut.h <= 0) throw new Error("cut has no size");
  const scale = Math.min((g.maxW * stage.w) / cut.w, (g.maxH * stage.h) / cut.h);
  const w = Math.max(1, Math.round(cut.w * scale));
  const h = Math.max(1, Math.round(cut.h * scale));
  const x = clamp(Math.round(g.anchorX * stage.w - w / 2), 0, stage.w - w);
  const y = clamp(Math.round(g.floorY * stage.h - h), 0, stage.h - h);
  return { x, y, w, h };
}

// Soft ellipse under the product: 1.1× product width, 0.12× tall, centred on the product's bottom edge.
export function shadowBox(place: Box, stage: Size): Box {
  const w = Math.max(2, Math.round(place.w * 1.1));
  const h = Math.max(2, Math.round(place.w * 0.12));
  const x = clamp(Math.round(place.x + place.w / 2 - w / 2), 0, Math.max(0, stage.w - w));
  const y = clamp(Math.round(place.y + place.h - h / 2), 0, Math.max(0, stage.h - h));
  return { x, y, w: Math.min(w, stage.w), h: Math.min(h, stage.h) };
}

// Largest crop of the given aspect (w/h) that fits the stage, horizontally centred on anchorX and clamped.
export function cropWindow(stage: Size, aspect: number, anchorX: number): Box {
  let w = stage.w;
  let h = Math.round(w / aspect);
  if (h > stage.h) {
    h = stage.h;
    w = Math.round(h * aspect);
  }
  const x = clamp(Math.round(anchorX * stage.w - w / 2), 0, stage.w - w);
  const y = Math.round((stage.h - h) / 2);
  return { x, y, w, h };
}

// The product region in the original upload, at the same scale as the staged product (Compare panel, X13).
export function compareScale(cut: Size, place: Box): number {
  return place.w / cut.w;
}
