import type { Asset, CloudPort } from "../cloud";
import { isValidGeometry, type Geometry } from "../geometry";
import { DEFAULT_GEOMETRY, SCENES, STAGE_MODELS } from "../models";
import snapshot from "../stages.snapshot.json";

export type StageInfo = {
  publicId: string;
  w: number;
  h: number;
  geometry: Geometry;
  name: string;
  model: string;
  seed: number | null;
  library: boolean;
};

// Context keys written by scripts/setup.ts and by the generation service after a task completes (X14).
export function stageContext(s: Omit<StageInfo, "publicId" | "w" | "h" | "library"> & { prompt: string }): Record<string, string> {
  return {
    rs_name: s.name,
    rs_model: s.model,
    rs_seed: s.seed === null ? "n/a" : String(s.seed),
    rs_ax: String(s.geometry.anchorX),
    rs_fy: String(s.geometry.floorY),
    rs_mw: String(s.geometry.maxW),
    rs_mh: String(s.geometry.maxH),
    rs_prompt: s.prompt.slice(0, 200),
  };
}

export function toStage(a: Asset, library: boolean): StageInfo | null {
  const c = a.context ?? {};
  const g: Geometry = {
    anchorX: Number(c.rs_ax ?? DEFAULT_GEOMETRY.anchorX),
    floorY: Number(c.rs_fy ?? DEFAULT_GEOMETRY.floorY),
    maxW: Number(c.rs_mw ?? DEFAULT_GEOMETRY.maxW),
    maxH: Number(c.rs_mh ?? DEFAULT_GEOMETRY.maxH),
  };
  if (!a.width || !a.height || !isValidGeometry(g)) return null;
  const seed = Number(c.rs_seed);
  return {
    publicId: a.publicId,
    w: a.width,
    h: a.height,
    geometry: g,
    name: c.rs_name ?? "Stage",
    model: c.rs_model ?? "unknown",
    seed: Number.isFinite(seed) ? seed : null,
    library,
  };
}

// Showcase order: scenes in art-direction order, models in table order, so the first strip is one scene on 3 models
// (Track 2: model choice side by side). Library IDs are realstage/lib/<scene>-<family>.
function rank(s: StageInfo): [number, number] {
  const [scene, ...fam] = s.publicId.split("/").pop()!.split("-");
  const si = SCENES.findIndex((x) => x.key === scene);
  const mi = STAGE_MODELS.findIndex((m) => m.family === fam.join("-"));
  return [si < 0 ? 99 : si, mi < 0 ? 99 : mi];
}
export function byShowcase(a: StageInfo, b: StageInfo): number {
  const [as, am] = rank(a), [bs, bm] = rank(b);
  return as - bs || am - bm || a.publicId.localeCompare(b.publicId);
}

let libCache: { at: number; stages: StageInfo[] } | null = null;

// Library stages from Cloudinary (tag `lib`), cached 60 s; on any Admin API error fall back to the bundled snapshot
// so the grid is never empty (CEO-T3 / T-E9).
export async function libraryStages(port: CloudPort): Promise<{ stages: StageInfo[]; source: "live" | "snapshot" }> {
  if (libCache && Date.now() - libCache.at < 60_000) return { stages: libCache.stages, source: "live" };
  try {
    const assets = await port.listTag("lib");
    const stages = assets.map((a) => toStage(a, true)).filter((s): s is StageInfo => !!s).sort(byShowcase);
    if (!stages.length) return { stages: snapshot as StageInfo[], source: "snapshot" };
    libCache = { at: Date.now(), stages };
    return { stages, source: "live" };
  } catch {
    return { stages: snapshot as StageInfo[], source: "snapshot" };
  }
}

const sessionCache = new Map<string, { at: number; stages: StageInfo[] }>();

// Cached 10 s per session to stay inside the Free plan's Admin API budget (500 calls/hour).
export async function sessionStages(port: CloudPort, sessionId: string): Promise<StageInfo[]> {
  const hit = sessionCache.get(sessionId);
  if (hit && Date.now() - hit.at < 10_000) return hit.stages;
  try {
    const assets = await port.listTag(`session-${sessionId}`);
    const stages = assets.filter((a) => a.tags.includes("stage")).map((a) => toStage(a, false)).filter((s): s is StageInfo => !!s);
    sessionCache.set(sessionId, { at: Date.now(), stages });
    if (sessionCache.size > 500) sessionCache.delete(sessionCache.keys().next().value!);
    return stages;
  } catch {
    return [];
  }
}

// Server-side source of truth for a stage: never trust client-sent size or geometry. A session may use library
// stages and its own generated stages only.
export async function resolveStage(port: CloudPort, sessionId: string, publicId: unknown): Promise<StageInfo | null> {
  // Ownership comes from server-set tags, not the ID: generated assets get Cloudinary-assigned IDs (no realstage/ prefix).
  if (typeof publicId !== "string" || !/^[A-Za-z0-9_/-]{1,200}$/.test(publicId)) return null;
  const a = await port.getResource(publicId);
  if (!a) return null;
  const allowed = a.tags.includes("lib") || (a.tags.includes("stage") && a.tags.includes(`session-${sessionId}`));
  return allowed ? toStage(a, a.tags.includes("lib")) : null;
}

export function resetStageCache() {
  libCache = null;
  sessionCache.clear();
}
