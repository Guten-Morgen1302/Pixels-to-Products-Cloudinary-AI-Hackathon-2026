// Relight bake-off (T-E13): composite vs Pixel-Lock relight on each sample, and alignment calibration
// (good relit score vs the same output shifted 8px). Spends 1 AI credit per sample from the build pool.
//   npm run bakeoff            (guarded: refuses if it would leave fewer than 21 credits)
import "./env";
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { createCloud } from "../lib/cloud";
import { getConfig } from "../lib/config";
import { readQuota } from "../lib/budget";
import { placeProduct } from "../lib/geometry";
import { alignmentScore } from "../lib/image-checks";
import { BUDGET, EDIT_MODEL } from "../lib/models";
import { makeCutout } from "../lib/services/cutout";
import { pollRelight, startRelight } from "../lib/services/generate";
import { libraryStages } from "../lib/services/stages";
import { deliveryUrl } from "../lib/urls";

const cfg = { ...getConfig(), genMode: "live" as const, liveAi: true };
const port = createCloud(cfg);
const SID = "b".repeat(24);
const LIMIT = Number(process.env.BAKEOFF_SAMPLES ?? 3);

(async () => {
  const remaining = await readQuota(port);
  if (remaining !== undefined && remaining - LIMIT * EDIT_MODEL.credits < BUDGET.buildReserve) {
    console.log(`build guard: ${remaining} remaining; bake-off needs ${LIMIT} and must keep ${BUDGET.buildReserve}. Stopping.`);
    process.exit(1);
  }
  const samples = (await port.listTag("sample")).filter((a) => !/_(cut|core)$/.test(a.publicId)).slice(0, LIMIT);
  const { stages } = await libraryStages(port);
  if (!samples.length || !stages.length) throw new Error("run npm run setup:generate first");
  const rows: string[] = [];
  for (const [i, s] of samples.entries()) {
    const stage = stages[i % stages.length];
    const cut = await makeCutout(port, SID, s.publicId);
    const input = { stage: { publicId: stage.publicId, w: stage.w, h: stage.h, geometry: stage.geometry }, cut: cut.cut, coreId: cut.coreId };
    const t0 = Date.now();
    // Bake-off bypasses the production pool on purpose (build pool); it is guarded above by remaining quota.
    const start = await startRelight(port, cfg, SID, input, "build").catch((e) => ({ error: e.message }) as any);
    if ("error" in start) { rows.push(`| ${s.context.rs_name} | ${stage.name} | — | — | — | error: ${start.error} |`); continue; }
    let out: any = { status: "pending" };
    while (out.status === "pending" && Date.now() - t0 < 120_000) {
      await new Promise((r) => setTimeout(r, 3000));
      out = await pollRelight(port, cfg, SID, start.taskId, start.compositeId, input).catch((e) => ({ status: "error", error: e.message }));
    }
    const secs = Math.round((Date.now() - t0) / 1000);
    let shifted = "—";
    if (out.status === "done" && !out.fallback) {
      const [comp, relit, cutPng] = await Promise.all([
        port.fetchBuffer(deliveryUrl(port.cloud, start.compositeId, ["f_png"])),
        port.fetchBuffer(deliveryUrl(port.cloud, out.finalId, ["f_png"])),
        port.fetchBuffer(deliveryUrl(port.cloud, cut.cut.publicId, ["f_png"])),
      ]);
      const moved = await sharp(relit.buf).extend({ left: 8, top: 8, right: 0, bottom: 0, background: "#808080" }).extract({ left: 0, top: 0, width: stage.w, height: stage.h }).png().toBuffer();
      const place = placeProduct({ w: stage.w, h: stage.h }, cut.cut, stage.geometry);
      shifted = (await alignmentScore(comp.buf, moved, cutPng.buf, { w: stage.w, h: stage.h }, place)).toFixed(2);
    }
    rows.push(`| ${s.context.rs_name} | ${stage.name} | ${out.status === "done" ? (out.fallback ? "kept exact" : "relit") : out.status} | ${out.alignment ?? "—"} | ${shifted} | ${secs}s |`);
    console.log(rows.at(-1));
  }
  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/bakeoff.md", ["# Relight bake-off", "", `Run ${new Date().toISOString()} · edit model ${EDIT_MODEL.id}`, "", "| Sample | Stage | Result | Alignment (relit) | Alignment (relit shifted 8px) | Time |", "|---|---|---|---|---|---|", ...rows, "", "Threshold rule: midpoint of the good and shifted columns, floor 0.5 → set ALIGN_THRESHOLD in lib/models.ts.", ""].join("\n"));
  console.log("wrote docs/bakeoff.md");
})().catch((e) => {
  console.error("bakeoff failed:", e?.error?.message ?? e?.message ?? e);
  process.exit(1);
});
