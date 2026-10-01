import type { Asset, CloudPort } from "../cloud";
import { isValidGeometry, type Geometry } from "../geometry";
import { DEFAULT_GEOMETRY } from "../models";
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

let libCache: { at: number; stages: StageInfo[] } | null = null;

// Library stages from Cloudinary (tag `lib`), cached 60 s; on any Admin API error fall back to the bundled snapshot
// so the grid is never empty (CEO-T3 / T-E9).
export async function libraryStages(port: CloudPort): Promise<{ stages: StageInfo[]; source: "live" | "snapshot" }> {
  if (libCache && Date.now() - libCache.at < 60_000) return { stages: libCache.stages, source: "live" };
  try {
    const assets = await port.listTag("lib");
    const stages = assets.map((a) => toStage(a, true)).filter((s): s is StageInfo => !!s).sort((a, b) => a.publicId.localeCompare(b.publicId));
    if (!stages.length) return { stages: snapshot as StageInfo[], source: "snapshot" };
    libCache = { at: Date.now(), stages };
    return { stages, source: "live" };
  } catch {
    return { stages: snapshot as StageInfo[], source: "snapshot" };
  }
}

export async function sessionStages(port: CloudPort, sessionId: string): Promise<StageInfo[]> {
  try {
    const assets = await port.listTag(`session-${sessionId}`);
    return assets.filter((a) => a.tags.includes("stage")).map((a) => toStage(a, false)).filter((s): s is StageInfo => !!s);
  } catch {
    return [];
  }
}

export function resetStageCache() {
  libCache = null;
}
