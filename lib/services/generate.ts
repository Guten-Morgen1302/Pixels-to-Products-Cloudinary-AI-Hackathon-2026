// Live generation (Track 2 proof): 3-model stage fan-out and Pixel-Lock relight.
// GEN_MODE=mock (default in dev/tests) never calls /v2/generate: 0 credits (Budget Lock rule 1).
import { randomInt, randomUUID } from "node:crypto";
import type { CloudPort, GenAsset, GenResult } from "../cloud";
import type { Config } from "../config";
import { recordQuota, reserveGeneration, settleCost } from "../budget";
import { placeProduct } from "../geometry";
import { alignmentScore } from "../image-checks";
import { ALIGN_THRESHOLD, DEFAULT_GEOMETRY, EDIT_MODEL, GEN_OPTIONS, STAGE_MODELS, STAGE_RESOLUTION, stagePrompt } from "../models";
import { expTag, ownsAsset, sessionFolder } from "../session";
import { compositeSourceUrl, deliveryUrl, pixelLockSourceUrl, type CutRef, type StageRef } from "../urls";
import { AppError, MESSAGES } from "./errors";
import { libraryStages, resolveStage, stageContext, toStage, type StageInfo } from "./stages";

const MOCK_DELAY_MS = 3000;
export const GEN_PRESET = "realstage_gen";

function genError(r: GenResult): AppError {
  const e = (r.error ?? "").toLowerCase();
  if (/quota|limit|credit|insufficient/.test(e)) return new AppError("GEN_QUOTA", MESSAGES.GEN_QUOTA, 503);
  if (/moderat|safety|declin|refus|policy/.test(e)) return new AppError("GEN_REFUSED", MESSAGES.GEN_REFUSED, 422);
  return new AppError("GEN_FAILED", MESSAGES.GEN_FAILED, 502);
}

export function cleanPrompt(raw: unknown): string {
  const p = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  if (p.length < 3) throw new AppError("BAD_REQUEST", "Describe a scene, e.g. teak shelf, morning light.");
  return p;
}

const nameFromPrompt = (p: string) => p.split(/[,.]/)[0].split(" ").slice(0, 3).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");

// ---- stages fan-out ---------------------------------------------------------------------------

export async function startStages(port: CloudPort, cfg: Config, rawPrompt: unknown, rawModel: unknown, visitor: string) {
  const prompt = cleanPrompt(rawPrompt);
  const option = GEN_OPTIONS.find((o) => o.modelId === rawModel);
  if (!option) throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
  const m = STAGE_MODELS.find((x) => x.id === option.modelId)!;
  const r = await reserveGeneration(port, cfg, option.credits, visitor); // whole set reserved before the first call (R2-3)
  if (!r.ok) throw new AppError("BUDGET_PAUSED", MESSAGES.BUDGET_PAUSED, 503);

  const slots = Array.from({ length: option.count }, (_, i) => i);
  if (cfg.genMode === "mock") {
    const t = Date.now();
    return { prompt, model: m.id, tasks: slots.map((i) => ({ model: m.id, taskId: `mock:stage:${i}:${t}`, error: undefined as string | undefined })) };
  }
  const base = randomInt(1, 2_000_000);
  const tasks = await Promise.all(
    slots.map(async (i) => {
      // One model failing (even a network throw) must not lose the other two tasks.
      try {
      const res = await port.generate("text_to_image", {
        prompt: stagePrompt(prompt),
        model: { id: m.id },
        image_size: { aspect_ratio: "1:1", resolution: STAGE_RESOLUTION },
        ...(m.seed ? { seed: base + i * 7919 } : {}), // distinct seeds = variations
        async: true,
        target: { target_type: "managed_asset", upload_preset: GEN_PRESET },
      });
      await recordQuota(port, res.quotaRemaining);
      if (res.status === "failed" || !res.taskId) return { model: m.id, taskId: "", error: res.status === "failed" ? genError(res).code : "GEN_FAILED" };
      return { model: m.id, taskId: res.taskId, error: undefined as string | undefined };
      } catch {
        return { model: m.id, taskId: "", error: "GEN_FAILED" as string | undefined };
      }
    }),
  );
  return { prompt, model: m.id, tasks };
}

export async function pollStage(port: CloudPort, cfg: Config, sessionId: string, taskId: string, prompt: string): Promise<{ status: "pending" | "done"; stage?: StageInfo }> {
  if (taskId.startsWith("mock:stage:")) {
    const [, , idx, t] = taskId.split(":");
    if (Date.now() - Number(t) < MOCK_DELAY_MS) return { status: "pending" };
    const { stages } = await libraryStages(port);
    if (!stages.length) throw new AppError("GEN_FAILED", "No library stages yet. Run npm run setup:generate.", 503);
    const base = stages[Number(idx) % stages.length];
    return { status: "done", stage: { ...base, name: `${nameFromPrompt(prompt)} (mock)`, library: false } };
  }
  if (cfg.genMode === "mock") throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
  const res = await port.task(taskId);
  await recordQuota(port, res.quotaRemaining);
  if (res.status === "pending") return { status: "pending" };
  if (res.status === "failed" || !res.assets?.length) throw genError(res);
  const a: GenAsset = res.assets[0];
  await settleCost(port, res.usedByRequest, STAGE_MODELS.find((m) => m.id === a.modelId)?.credits ?? 1);
  const info = { name: nameFromPrompt(prompt), model: a.modelId, seed: a.seed || null, geometry: DEFAULT_GEOMETRY, prompt };
  // X14: tags + geometry before the card is ever shown.
  await port.update(a.publicId, { tags: ["realstage", "stage", `session-${sessionId}`, expTag()], context: stageContext(info) });
  const stage = toStage({ publicId: a.publicId, width: a.width, height: a.height, bytes: 0, format: "", tags: [], context: stageContext(info) }, false);
  if (!stage) throw new AppError("GEN_FAILED", MESSAGES.GEN_FAILED, 502);
  return { status: "done", stage };
}

// ---- relight + Pixel-Lock ---------------------------------------------------------------------

export type RelightInput = { stage: StageRef; cut: CutRef; coreId: string };

// Resolve stage + cut from Cloudinary, ignoring client-sent sizes and geometry (they drive URLs and sharp extracts).
async function resolveRelightInput(port: CloudPort, sessionId: string, i: RelightInput): Promise<RelightInput> {
  const cutId = i?.cut?.publicId;
  if (typeof cutId !== "string" || !ownsAsset(sessionId, cutId) || !cutId.endsWith("_cut")) throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
  const [stage, cut] = await Promise.all([resolveStage(port, sessionId, i?.stage?.publicId), port.getResource(cutId)]);
  if (!stage || !cut || !cut.width || !cut.height) throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
  return {
    stage: { publicId: stage.publicId, w: stage.w, h: stage.h, geometry: stage.geometry },
    cut: { publicId: cutId, w: cut.width, h: cut.height },
    coreId: cutId.replace(/_cut$/, "_core"),
  };
}

// pool "build" is only for operator scripts (bake-off), which guard spend against remaining quota themselves (X2).
export async function startRelight(port: CloudPort, cfg: Config, sessionId: string, rawInput: RelightInput, visitor: string, pool: "prod" | "build" = "prod") {
  const input = await resolveRelightInput(port, sessionId, rawInput);
  if (pool === "prod") {
    const r = await reserveGeneration(port, cfg, EDIT_MODEL.credits, visitor);
    if (!r.ok) throw new AppError("BUDGET_PAUSED", MESSAGES.BUDGET_PAUSED, 503);
  }
  const compositeId = `${sessionFolder(sessionId)}/comp-${randomUUID().slice(0, 12)}`;
  const comp = await port.uploadFromUrl(compositeSourceUrl(port.cloud, input.stage, input.cut), {
    publicId: compositeId,
    tags: ["realstage", `session-${sessionId}`, expTag()],
  });
  if (cfg.genMode === "mock") return { compositeId, taskId: `mock:relight:${Date.now()}` };

  const res = await port.generate("image_to_image", {
    prompt: "Relight [1]: keep the product, its position, size and labels exactly; match the scene's light; add a soft natural contact shadow under the product.",
    reference_images: [{ source_type: "managed_asset", asset_id: comp.assetId }],
    model: { id: EDIT_MODEL.id },
    image_size: { width: input.stage.w, height: input.stage.h },
    seed: randomInt(1, 2_000_000),
    async: true,
    target: { target_type: "managed_asset", upload_preset: GEN_PRESET },
  });
  await recordQuota(port, res.quotaRemaining);
  if (res.status === "failed" || !res.taskId) throw genError(res);
  return { compositeId, taskId: res.taskId };
}

export type RelightOutcome = { status: "pending" } | { status: "done"; finalId: string; alignment: number | null; fallback: boolean };

export async function pollRelight(port: CloudPort, cfg: Config, sessionId: string, taskId: string, compositeId: string, rawInput: RelightInput): Promise<RelightOutcome> {
  const input = await resolveRelightInput(port, sessionId, rawInput);
  if (!ownsAsset(sessionId, compositeId)) throw new AppError("FORBIDDEN", MESSAGES.FORBIDDEN, 403);
  let relitId: string;
  let relitSize: { w: number; h: number };
  if (taskId.startsWith("mock:relight:")) {
    if (Date.now() - Number(taskId.split(":")[2]) < MOCK_DELAY_MS) return { status: "pending" };
    relitId = compositeId; // mock "relight" returns the composite itself
    relitSize = { w: input.stage.w, h: input.stage.h };
  } else {
    if (cfg.genMode === "mock") throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
    const res = await port.task(taskId);
    await recordQuota(port, res.quotaRemaining);
    if (res.status === "pending") return { status: "pending" };
    if (res.status === "failed" || !res.assets?.length) throw genError(res);
    await settleCost(port, res.usedByRequest, EDIT_MODEL.credits);
    relitId = res.assets[0].publicId;
    relitSize = { w: res.assets[0].width, h: res.assets[0].height };
    await port.update(relitId, { tags: ["realstage", `session-${sessionId}`, expTag()] }).catch(() => undefined);
  }

  const fallback = (alignment: number | null) => ({ status: "done" as const, finalId: compositeId, alignment, fallback: true });
  // Reframed output (aspect drift) can't be mapped back to the same geometry (R1-6).
  if (Math.abs(relitSize.w / relitSize.h - input.stage.w / input.stage.h) > 0.02) return fallback(null);

  const [comp, relit, cutPng] = await Promise.all([
    port.fetchBuffer(deliveryUrl(port.cloud, compositeId, ["f_png"])),
    port.fetchBuffer(deliveryUrl(port.cloud, relitId, [`c_scale,w_${input.stage.w},h_${input.stage.h}`, "f_png"])),
    port.fetchBuffer(deliveryUrl(port.cloud, input.cut.publicId, ["f_png"])),
  ]);
  if (comp.status !== 200 || relit.status !== 200 || cutPng.status !== 200) return fallback(null);
  const place = placeProduct({ w: input.stage.w, h: input.stage.h }, input.cut, input.stage.geometry);
  const score = await alignmentScore(comp.buf, relit.buf, cutPng.buf, { w: input.stage.w, h: input.stage.h }, place);
  if (score < ALIGN_THRESHOLD) return fallback(Number(score.toFixed(2)));

  const finalId = `${sessionFolder(sessionId)}/relit-${randomUUID().slice(0, 12)}`;
  await port.uploadFromUrl(pixelLockSourceUrl(port.cloud, relitId, input.stage, input.cut, input.coreId), {
    publicId: finalId,
    tags: ["realstage", `session-${sessionId}`, expTag()],
  });
  return { status: "done", finalId, alignment: Number(score.toFixed(2)), fallback: false };
}
