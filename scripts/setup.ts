// One-time, idempotent account setup. Safe to re-run: nothing is regenerated if it already exists.
//
//   npm run setup             shadow asset, upload preset, metadata fields, 3 pre-cut samples, snapshot   (0 AI credits)
//   npm run setup:generate    + library stages via /v2/generate (build pool, guarded)                      (≤ 20 AI credits)
//
// Build-pool guard (Outside Voice X2): refuses any generation that would leave fewer than 21 credits
// (15 production reserve + 6 floor).
import "./env";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { createCloud } from "../lib/cloud";
import { getConfig } from "../lib/config";
import { makeCore, cutoutCoverage } from "../lib/image-checks";
import { BUDGET, DEFAULT_GEOMETRY, SCENES, STAGE_MODELS, STAGE_RESOLUTION, stagePrompt } from "../lib/models";
import { libraryStages, resetStageCache, stageContext } from "../lib/services/stages";
import { GEN_PRESET } from "../lib/services/generate";
import { recordQuota, readQuota } from "../lib/budget";
import { cutoutSourceUrl, deliveryUrl, SHADOW_ASSET } from "../lib/urls";

const cfg = getConfig();
const port = createCloud(cfg);
const GENERATE = process.argv.includes("--generate");
const LIB_SCENES = Number(process.env.LIB_SCENES ?? 4);
const LIB_CREDIT_CAP = 20;
// Restrict which model families build the library, e.g. LIB_MODELS=flux (1 credit each). Default: all.
const LIB_MODELS = (process.env.LIB_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// Default samples: Cloudinary's public demo e-commerce photos. Replace with your own phone shots via
// SAMPLES="Steel tumbler|https://...,Saree|https://...,Pickle jar|https://..." for the final demo.
const SAMPLES = (process.env.SAMPLES ?? "Leather bag|https://res.cloudinary.com/demo/image/upload/samples/ecommerce/leather-bag-gray.jpg,Analog watch|https://res.cloudinary.com/demo/image/upload/samples/ecommerce/analog-classic.jpg,Sneakers|https://res.cloudinary.com/demo/image/upload/docs/shoes.jpg")
  .split(",")
  .map((s) => s.split("|"))
  .filter(([n, u]) => n && u);

const say = (m: string) => console.log(m);

async function shadowAsset() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="120"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#000" stop-opacity="0.85"/><stop offset="55%" stop-color="#000" stop-opacity="0.35"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="400" cy="60" rx="400" ry="60" fill="url(#g)"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await port.uploadBuffer(png, { publicId: SHADOW_ASSET, tags: ["realstage", "realstage-asset"], overwrite: true });
  say(`✓ contact-shadow asset (${SHADOW_ASSET})`);
}

async function uploadPreset() {
  const opts = { unsigned: false, folder: "realstage/stages", tags: "realstage,stage", overwrite: false, unique_filename: true };
  try {
    await cloudinary.api.create_upload_preset({ name: GEN_PRESET, ...opts });
    say(`✓ upload preset ${GEN_PRESET} created`);
  } catch (e: any) {
    if (/exist|taken/i.test(e?.error?.message ?? e?.message ?? "")) {
      await cloudinary.api.update_upload_preset(GEN_PRESET, opts);
      say(`✓ upload preset ${GEN_PRESET} updated`);
    } else throw e;
  }
}

async function metadataFields() {
  const fields: any[] = [
    { type: "string", external_id: "rs_product_name", label: "RealStage product name" },
    { type: "string", external_id: "rs_stage_model", label: "RealStage stage model" },
    { type: "string", external_id: "rs_alignment", label: "RealStage alignment score" },
    { type: "enum", external_id: "rs_pixel_locked", label: "RealStage real pixels locked", datasource: { values: [{ external_id: "yes", value: "yes" }, { external_id: "no", value: "no" }] } },
  ];
  const existing = new Set(((await cloudinary.api.list_metadata_fields()) as any).metadata_fields.map((f: any) => f.external_id));
  for (const f of fields) {
    if (existing.has(f.external_id)) continue;
    await cloudinary.api.add_metadata_field(f);
  }
  say(`✓ structured metadata fields (${fields.length})`);
}

async function samples() {
  for (const [name, url] of SAMPLES) {
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `realstage/samples/${key}`;
    const orig = (await port.getResource(id)) ?? (await port.uploadFromUrl(url, { publicId: id, tags: ["realstage", "sample"], context: { rs_name: name } }));
    let cut = await port.getResource(`${id}_cut`);
    if (!cut) cut = await port.uploadFromUrl(cutoutSourceUrl(port.cloud, id), { publicId: `${id}_cut`, tags: ["realstage", "realstage-sample-asset"] });
    const png = await port.fetchBuffer(deliveryUrl(port.cloud, `${id}_cut`, ["f_png"]));
    if (png.status !== 200) throw new Error(`cutout for ${name} returned HTTP ${png.status} ${png.error ?? ""}`);
    const coverage = await cutoutCoverage(png.buf, orig.width, orig.height);
    if (!(await port.getResource(`${id}_core`))) await port.uploadBuffer(await makeCore(png.buf), { publicId: `${id}_core`, tags: ["realstage", "realstage-sample-asset"] });
    await port.update(id, { context: { rs_name: name, rs_cut_w: String(cut.width), rs_cut_h: String(cut.height) } });
    await port.update(`${id}_cut`, { context: { rs_coverage: coverage.toFixed(4) } });
    say(`✓ sample "${name}" ${orig.width}×${orig.height} → cut ${cut.width}×${cut.height}, coverage ${(coverage * 100).toFixed(1)}%`);
  }
}

async function library() {
  let spent = 0;
  let remaining = await readQuota(port);
  for (const scene of SCENES.slice(0, LIB_SCENES)) {
    for (const m of STAGE_MODELS.filter((x) => !LIB_MODELS.length || LIB_MODELS.includes(x.family))) {
      const id = `realstage/lib/${scene.key}-${m.family}`;
      if (await port.getResource(id)) {
        say(`· ${id} exists, skipped (0 credits)`);
        continue;
      }
      if (spent + m.credits > LIB_CREDIT_CAP) return say(`! library credit cap ${LIB_CREDIT_CAP} reached, stopping`);
      if (remaining !== undefined && remaining - m.credits < BUDGET.buildReserve) return say(`! build guard: ${remaining} remaining, keeping ${BUDGET.buildReserve} for production + floor. Stopping.`);
      const seed = m.seed ? 1000 + SCENES.indexOf(scene) * 10 + STAGE_MODELS.indexOf(m) : undefined;
      const res = await port.generate("text_to_image", {
        prompt: stagePrompt(scene.prompt),
        model: { id: m.id },
        image_size: { aspect_ratio: "1:1", resolution: STAGE_RESOLUTION },
        ...(seed ? { seed } : {}),
        target: { target_type: "managed_asset", public_id: id },
      });
      await recordQuota(port, res.quotaRemaining);
      if (res.status !== "done" || !res.assets?.length) {
        say(`✗ ${id}: ${res.error ?? res.status}`);
        continue;
      }
      remaining = res.quotaRemaining ?? remaining;
      spent += res.usedByRequest ?? m.credits;
      const a = res.assets[0];
      await port.update(a.publicId, { tags: ["realstage", "stage", "lib"], context: stageContext({ name: scene.name, model: a.modelId, seed: m.seed ? a.seed : null, geometry: DEFAULT_GEOMETRY, prompt: scene.prompt }) });
      say(`✓ ${a.publicId} ${a.width}×${a.height} via ${a.modelId} · cost ${res.usedByRequest ?? "?"} · remaining ${res.quotaRemaining ?? "?"}`);
    }
  }
  say(`library: ${spent} credits spent this run`);
}

async function snapshot() {
  resetStageCache();
  const { stages, source } = await libraryStages(port);
  if (source === "live") writeFileSync("lib/stages.snapshot.json", JSON.stringify(stages, null, 2) + "\n");
  say(`✓ snapshot: ${stages.length} library stages (${source})`);
}

(async () => {
  say(`RealStage setup on cloud "${port.cloud}" · generate=${GENERATE}`);
  await shadowAsset();
  await uploadPreset();
  await metadataFields().catch((e) => say(`! metadata fields skipped: ${e?.error?.message ?? e?.message}`));
  await samples();
  if (GENERATE) await library();
  await snapshot();
  const u = await port.usage();
  say(`plan credits used: ${u.creditsUsed} of ${u.creditsLimit} (${u.plan})`);
})().catch((e) => {
  console.error("setup failed:", e?.error?.message ?? e?.message ?? e);
  process.exit(1);
});
