// Single table for generation models, scenes and budget numbers (plan: X1, Budget Lock, DESIGN.md art direction).
// Credit costs VERIFIED on 2026-10-01 from limits.addons_quota.used_by_request at 1K:
//   flux-2-klein-9b = 1, nano-banana-1 = 4, recraft-v3 = 4.

export type StageModel = { id: string; family: string; label: string; seed: boolean; credits: number };

export const STAGE_MODELS: StageModel[] = [
  { id: "flux-2-klein-9b", family: "flux", label: "Flux", seed: true, credits: 1 },
  { id: "nano-banana-1", family: "nano-banana", label: "Nano Banana", seed: true, credits: 4 },
  { id: "recraft-v3", family: "recraft", label: "Recraft", seed: false, credits: 4 },
];

// Live generation = Track 2's "variations and model choice": the visitor picks a model and sees its real price.
// Cheap Flux gives 3 seeded variations; the premium models give 1 image each.
export type GenOption = { modelId: string; label: string; count: number; credits: number };
export const GEN_OPTIONS: GenOption[] = STAGE_MODELS.map((m) => {
  const count = m.credits <= 1 ? 3 : 1;
  return { modelId: m.id, label: m.label, count, credits: count * m.credits };
});
export const DEFAULT_GEN_OPTION = GEN_OPTIONS[0].modelId;

export const EDIT_MODEL = { id: "flux-2-klein-9b-edit", seed: true, credits: 3 }; // verified 2026-10-01 (bake-off)
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
