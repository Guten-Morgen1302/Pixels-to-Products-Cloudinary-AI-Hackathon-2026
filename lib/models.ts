// Single table for generation models, scenes and budget numbers (plan: X1, Budget Lock, DESIGN.md art direction).
// Credit costs are verified from the first real generation response (limits.addons_quota.used_by_request).

export type StageModel = { id: string; family: string; seed: boolean; credits: number };

export const STAGE_MODELS: StageModel[] = [
  { id: "flux-2-klein-9b", family: "flux", seed: true, credits: 1 },
  { id: "nano-banana-1", family: "nano-banana", seed: true, credits: 1 },
  { id: "recraft-v3", family: "recraft", seed: false, credits: 1 },
];

export const EDIT_MODEL = { id: "flux-2-klein-9b-edit", seed: true, credits: 1 };
export const EDIT_MODEL_FALLBACK = { id: "nano-banana-1-edit", seed: true, credits: 1 };

export const BUDGET = {
  totalGenCredits: 50,
  prodPool: 15, // public live AI, whole judging window
  quotaFloor: 6, // never spend below this many remaining credits
  buildReserve: 21, // build scripts refuse if remaining - cost < 21 (prodPool + quotaFloor)
  uploadSignPool: 200,
  cutoutPool: 100,
};

export const STAGE_RESOLUTION = "1K" as const;

export const PROMPT_TAIL =
  "empty centre in the lower half for a product, no products, no text, no people, photographic, natural colors, eye-level camera, 50mm lens, soft light from the left.";

export type Scene = { key: string; name: string; prompt: string };

export const SCENES: Scene[] = [
  { key: "kota", name: "Kota stone", prompt: "polished grey kota stone floor corner, plain wall, morning daylight" },
  { key: "teak", name: "Teak shelf", prompt: "warm teak wood shelf against a lime-washed wall, soft window light" },
  { key: "terracotta", name: "Terracotta", prompt: "terracotta tile surface, sun-dried plaster wall, afternoon light" },
  { key: "brass", name: "Festive brass", prompt: "brass thali and jute runner at the edges, marigold petals far left, centre empty" },
  { key: "monsoon", name: "Monsoon sill", prompt: "white window sill, rain-blurred green garden outside, cool diffuse light" },
  { key: "marble", name: "Marble counter", prompt: "white marble kitchen counter, blurred steel utensils far right, bright daylight" },
];

export function stagePrompt(core: string): string {
  return `${core.trim().replace(/[.,;]+$/, "")}, ${PROMPT_TAIL}`;
}

// Pixel-Lock edge-NCC pass mark. Calibrated by scripts/bakeoff.ts (midpoint of good vs 8px-shifted scores, floor 0.5).
export const ALIGN_THRESHOLD = 0.5;

export const DEFAULT_GEOMETRY = { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 };
