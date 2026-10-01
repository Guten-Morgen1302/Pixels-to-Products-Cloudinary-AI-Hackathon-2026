import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { getConfig } from "@/lib/config";
import { resetBudgetCache } from "@/lib/budget";
import { parseGen } from "@/lib/cloud";
import { deleteExpired } from "@/lib/services/cleanup";
import { makeCutout, signUpload } from "@/lib/services/cutout";
import { cleanPrompt, pollRelight, pollStage, startRelight, startStages } from "@/lib/services/generate";
import { makeKit } from "@/lib/services/kit";
import { libraryStages, resetStageCache } from "@/lib/services/stages";
import { newSessionId, ownsAsset, signSession, verifySession } from "@/lib/session";
import { asset, fakeCloud } from "./fake-cloud";

const cfg = getConfig(); // mock mode from test/setup.ts
const live = { ...cfg, genMode: "live" as const, liveAi: true };
const SID = "a".repeat(24);
const libStage = asset("realstage/lib/kota", { tags: ["lib", "stage"], context: { rs_name: "Kota stone", rs_model: "flux-2-klein-9b", rs_seed: "42", rs_ax: "0.5", rs_fy: "0.8", rs_mw: "0.5", rs_mh: "0.6" } });

beforeEach(() => {
  resetBudgetCache();
  resetStageCache();
  vi.useRealTimers();
});

const png = (w: number, h: number, opaque: boolean) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 10, g: 10, b: 10, alpha: opaque ? 1 : 0 } } }).png().toBuffer();

describe("session", () => {
  it("round-trips, rejects tampering, scopes assets", () => {
    const id = newSessionId();
    const c = signSession(id, "s3cret");
    expect(verifySession(c, "s3cret")).toBe(id);
    expect(verifySession(c.replace(/.$/, "x"), "s3cret")).toBeNull();
    expect(verifySession(`${"b".repeat(24)}.${c.split(".")[1]}`, "s3cret")).toBeNull();
    expect(ownsAsset(id, `realstage/u/${id}/x`)).toBe(true);
    expect(ownsAsset(id, `realstage/u/${"c".repeat(24)}/x`)).toBe(false);
    expect(ownsAsset(id, "realstage/samples/tumbler")).toBe(true);
  });
});

describe("signUpload", () => {
  it("signs only server-chosen params, one public_id in the session folder, overwrite false", async () => {
    const c = fakeCloud();
    const u = await signUpload(c, cfg, SID, "v");
    expect(u.public_id.startsWith(`realstage/u/${SID}/`)).toBe(true);
    expect(u.overwrite).toBe("false");
    expect(u.signature).toBe("sig(allowed_formats,overwrite,public_id,tags,transformation)");
    expect(c.raw.has("realstage/ledger/sign-001")).toBe(true);
  });
  it("refuses when uploads are off", async () => {
    await expect(signUpload(fakeCloud(), { ...cfg, liveUploads: false }, SID, "v")).rejects.toMatchObject({ code: "BUDGET_PAUSED" });
  });
});

describe("makeCutout", () => {
  const orig = `realstage/u/${SID}/p1`;

  it("rejects another session's photo", async () => {
    await expect(makeCutout(fakeCloud(), SID, `realstage/u/${"c".repeat(24)}/p1`, "v")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deletes an oversized original", async () => {
    const c = fakeCloud([asset(orig, { bytes: 11 * 1024 * 1024 })]);
    await expect(makeCutout(c, SID, orig, "v")).rejects.toMatchObject({ code: "TOO_LARGE" });
    expect(c.assets.has(orig)).toBe(false);
  });

  it("rejects a cutout with no product", async () => {
    const c = fakeCloud([asset(orig)]);
    c.buffers.set("f_png/" + orig + "_cut", { status: 200, buf: await png(100, 100, false) });
    await expect(makeCutout(c, SID, orig, "v")).rejects.toMatchObject({ code: "NO_PRODUCT" });
  });

  it("materializes _cut from the canonical string and builds _core", async () => {
    const c = fakeCloud([asset(orig)]);
    c.buffers.set("f_png/" + orig + "_cut", { status: 200, buf: await png(600, 600, true) });
    const r = await makeCutout(c, SID, orig, "v");
    expect(r.cut.publicId).toBe(`${orig}_cut`);
    expect(c.assets.get(`${orig}_cut`)!.context.src).toContain("e_background_removal/e_trim/f_png");
    expect(c.assets.has(`${orig}_core`)).toBe(true);
    expect(r.coverage).toBeGreaterThan(0.3);
  });

  it("samples use pre-made cutouts without spending the cutout pool", async () => {
    const s = "realstage/samples/tumbler";
    const c = fakeCloud([asset(s), asset(`${s}_cut`, { width: 400, height: 800 }), asset(`${s}_core`)]);
    const r = await makeCutout(c, SID, s, "v");
    expect(r.cut).toEqual({ publicId: `${s}_cut`, w: 400, h: 800 });
    expect(c.raw.size).toBe(0);
  });
});

describe("stages", () => {
  it("falls back to the snapshot when the Admin API fails", async () => {
    const c = fakeCloud([libStage]);
    c.failListing = true;
    expect((await libraryStages(c)).source).toBe("snapshot");
  });
  it("reads geometry and provenance from context", async () => {
    const { stages } = await libraryStages(fakeCloud([libStage]));
    expect(stages[0]).toMatchObject({ name: "Kota stone", model: "flux-2-klein-9b", seed: 42, geometry: { anchorX: 0.5 } });
  });
});

describe("generation", () => {
  it("mock fan-out never calls /v2/generate and returns library stages after the delay", async () => {
    const c = fakeCloud([libStage]);
    const r = await startStages(c, cfg, "teak shelf, morning light", "flux-2-klein-9b", "v");
    expect(r.tasks).toHaveLength(3);
    expect(c.generated).toHaveLength(0);
    expect(await pollStage(c, cfg, SID, r.tasks[0].taskId, r.prompt)).toEqual({ status: "pending" });
    vi.useFakeTimers({ now: Date.now() + 4000 });
    const done = await pollStage(c, cfg, SID, r.tasks[0].taskId, r.prompt);
    expect(done.stage?.name).toBe("Teak Shelf (mock)");
  });

  it("premium model = 1 image, its real price reserved (nano-banana-1 = 4 credits)", async () => {
    const c = fakeCloud();
    const r = await startStages(c, live, "teak shelf", "nano-banana-1", "v");
    expect(r.tasks).toHaveLength(1);
    expect([...c.raw].filter((k) => k.startsWith("realstage/ledger/prod-"))).toHaveLength(4);
  });

  it("unknown model is rejected before any spend", async () => {
    const c = fakeCloud();
    await expect(startStages(c, live, "teak shelf", "gpt-image-2", "v")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.raw.size).toBe(0);
  });

  it("live fan-out reserves 3 credits up front and sends the documented body", async () => {
    const c = fakeCloud();
    await startStages(c, live, "teak shelf", "flux-2-klein-9b", "v");
    expect([...c.raw].filter((k) => k.startsWith("realstage/ledger/prod-"))).toHaveLength(3);
    const seeds = c.generated.map((g) => (g.body as any).seed);
    expect(new Set(seeds).size).toBe(3); // 3 distinct seeds = 3 variations
    expect(c.generated).toHaveLength(3);
    expect(c.generated[0]).toMatchObject({ kind: "text_to_image", body: { async: true, image_size: { aspect_ratio: "1:1", resolution: "1K" }, target: { upload_preset: "realstage_gen" } } });
  });

  it("live relight sends the composite as reference [1] by managed asset id", async () => {
    const c = fakeCloud([libStage, asset(`realstage/u/${SID}/p1_cut`, { width: 500, height: 500 })]);
    const input = { stage: { publicId: "realstage/lib/kota", w: 1024, h: 1024, geometry: { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 } }, cut: { publicId: `realstage/u/${SID}/p1_cut`, w: 500, h: 500 }, coreId: `realstage/u/${SID}/p1_core` };
    const r = await startRelight(c, live, SID, input, "v");
    const body = c.generated[0].body as any;
    expect(body.prompt).toContain("[1]");
    expect(body.reference_images).toEqual([{ source_type: "managed_asset", asset_id: `aid-${r.compositeId}` }]);
    expect(body.image_size).toEqual({ width: 1024, height: 1024 });
  });

  it("relight falls back to the exact composite when the output aspect drifts", async () => {
    const c = fakeCloud([libStage, asset(`realstage/u/${SID}/p1_cut`, { width: 500, height: 500 })]);
    c.task = async () => ({ status: "done", assets: [{ publicId: "realstage/stages/r1", assetId: "x", width: 1024, height: 768, modelId: "m", seed: 1 }] });
    const input = { stage: { publicId: "realstage/lib/kota", w: 1024, h: 1024, geometry: { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 } }, cut: { publicId: `realstage/u/${SID}/p1_cut`, w: 500, h: 500 }, coreId: `realstage/u/${SID}/p1_core` };
    const r = await pollRelight(c, live, SID, "t1", `realstage/u/${SID}/comp-1`, input);
    expect(r).toEqual({ status: "done", finalId: `realstage/u/${SID}/comp-1`, alignment: null, fallback: true });
  });

  it("prompt is cleaned and bounded", () => {
    expect(cleanPrompt("  <b>teak</b>\n shelf ")).toBe("b teak /b shelf");
    expect(() => cleanPrompt("a")).toThrow();
    expect(cleanPrompt("x".repeat(500))).toHaveLength(200);
  });

  it("parseGen reads sync assets, async pending and quota", () => {
    expect(parseGen({ data: { status: "pending", task_id: "t9" } })).toMatchObject({ status: "pending", taskId: "t9" });
    const done = parseGen({ data: { result: { assets: [{ width: 1024, height: 1024, seed: 3, model: { id: "flux-2-klein-9b" }, storage: { public_id: "p", asset_id: "a" } }] } }, limits: { addons_quota: [{ remaining: 41 }] } });
    expect(done).toMatchObject({ status: "done", quotaRemaining: 41, assets: [{ publicId: "p", modelId: "flux-2-klein-9b" }] });
  });
});

describe("kit", () => {
  it("materializes a final, returns 4 files, flags a failed white check", async () => {
    const c = fakeCloud([libStage, asset(`realstage/u/${SID}/p1_cut`, { width: 500, height: 500 })]);
    const input = { stage: { publicId: "realstage/lib/kota", w: 1024, h: 1024, geometry: { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 }, name: "Kota", model: "flux-2-klein-9b" }, cut: { publicId: `realstage/u/${SID}/p1_cut`, w: 500, h: 500 }, productName: "jar" };
    const k = await makeKit(c, SID, input);
    expect(k.files).toHaveLength(4);
    expect(c.assets.get(k.finalId)!.tags.some((t) => t.startsWith("exp-"))).toBe(true);
    expect(k.amazonOk).toBe(false); // fake returns 404 for the Amazon fetch -> never claims success
  });
  it("refuses another session's cutout", async () => {
    await expect(makeKit(fakeCloud(), SID, { stage: { publicId: "realstage/lib/k", w: 1, h: 1, geometry: { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 }, name: "", model: "" }, cut: { publicId: "realstage/u/zzz/p_cut", w: 1, h: 1 }, productName: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("cleanup", () => {
  it("deletes only past exp- tags", async () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const c = fakeCloud([asset("old", { tags: ["exp-20261005"] }), asset("future", { tags: ["exp-20261015"] })]);
    const r = await deleteExpired(c, now);
    expect(r.deleted).toBe(1);
    expect(c.assets.has("future")).toBe(true);
  });
});

describe("review fixes (regressions)", () => {
  const cutA = asset(`realstage/u/${SID}/p1_cut`, { width: 500, height: 500 });
  const input = (stageId: string, extra: object = {}) => ({ stage: { publicId: stageId, w: 99999, h: 1, geometry: { anchorX: 0.5, floorY: 0.8, maxW: 5, maxH: 0.6 }, ...extra }, cut: { publicId: cutA.publicId, w: 1, h: 1 }, coreId: `realstage/u/${SID}/p1_core` });

  it("relight ignores client-sent stage size/geometry and uses the server's", async () => {
    const c = fakeCloud([libStage, cutA]);
    await startRelight(c, live, SID, input("realstage/lib/kota") as any, "v");
    expect((c.generated[0].body as any).image_size).toEqual({ width: 1024, height: 1024 });
  });

  it("relight refuses another session's stage and a stage that is not lib/own", async () => {
    const other = asset(`realstage/stages/x`, { tags: ["stage", `session-${"c".repeat(24)}`] });
    const c = fakeCloud([libStage, cutA, other]);
    await expect(startRelight(c, live, SID, input(other.publicId) as any, "v")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.generated).toHaveLength(0);
  });

  it("kit refuses an unknown stage", async () => {
    const c = fakeCloud([cutA]);
    await expect(makeKit(c, SID, { stage: { publicId: "realstage/nope", w: 1, h: 1, geometry: { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 }, name: "", model: "" }, cut: { publicId: cutA.publicId, w: 1, h: 1 }, productName: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cutout retries after PROCESSING reserve the cutout slot only once", async () => {
    const orig = `realstage/u/${SID}/p2`;
    const c = fakeCloud([asset(orig)]);
    const realUpload = c.uploadFromUrl;
    let calls = 0;
    c.uploadFromUrl = async (url, o) => { if (++calls === 1) throw new Error("423 still processing"); return realUpload(url, o); };
    c.buffers.set("f_png/" + orig + "_cut", { status: 200, buf: await png(600, 600, true) });
    await expect(makeCutout(c, SID, orig, "v")).rejects.toMatchObject({ code: "PROCESSING" });
    await makeCutout(c, SID, orig, "v");
    expect([...c.raw].filter((k) => k.startsWith("realstage/ledger/cut-"))).toHaveLength(1);
  });

  it("one model throwing does not lose the other two tasks", async () => {
    const c = fakeCloud();
    let n = 0;
    c.generate = async () => { if (++n === 2) throw new Error("network"); return { status: "pending", taskId: `t${n}` }; };
    const r = await startStages(c, live, "teak shelf", "flux-2-klein-9b", "v");
    expect(r.tasks.map((t) => Boolean(t.taskId))).toEqual([true, false, true]);
    expect(r.tasks[1].error).toBe("GEN_FAILED");
  });

  it("a finished task with no images is failed, not pending forever", () => {
    expect(parseGen({ data: { status: "completed", result: { assets: [] } } }).status).toBe("failed");
    expect(parseGen({ data: { status: "processing" } }).status).toBe("pending");
  });

  it("image checks accept grayscale PNGs", async () => {
    const { cutoutCoverage, makeCore } = await import("@/lib/image-checks");
    const gray = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).toColourspace("b-w").png().toBuffer();
    expect((await sharp(gray).metadata()).channels).toBeLessThan(3); // really gray(+alpha)
    expect(await cutoutCoverage(gray, 50, 50)).toBeGreaterThan(0.9);
    await expect(makeCore(gray)).resolves.toBeInstanceOf(Buffer);
  });
});

// Regression: live generate returned Cloudinary-assigned IDs without the realstage/ prefix (found 2026-10-01 pre-demo)
describe("resolveStage with Cloudinary-assigned generated IDs", () => {
  it("accepts this session's generated stage regardless of ID prefix, rejects other sessions", async () => {
    const { resolveStage } = await import("@/lib/services/stages");
    const ctx = { rs_name: "Brass", rs_model: "flux-2-klein-9b", rs_seed: "7", rs_ax: "0.5", rs_fy: "0.8", rs_mw: "0.5", rs_mh: "0.6" };
    const mine = asset("ki2rt3ylanyfswzs6jea", { tags: ["stage", `session-${SID}`], context: ctx });
    const theirs = asset("zzzzzzzzzzzzzzzzzzzz", { tags: ["stage", `session-${"c".repeat(24)}`], context: ctx });
    const c = fakeCloud([mine, theirs]);
    expect((await resolveStage(c, SID, mine.publicId))?.name).toBe("Brass");
    expect(await resolveStage(c, SID, theirs.publicId)).toBeNull();
    expect(await resolveStage(c, SID, "../../etc")).toBeNull();
  });
});
