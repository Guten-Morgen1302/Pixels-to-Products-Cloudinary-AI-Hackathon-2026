// Free-tier gate for RealStage (plan: docs/designs/realstage.md, Budget Lock + Outside Voice Round).
// Runs checks 2–6 against the real Cloudinary account. Check 1 (model credit costs) is read in the Console.
// Spends ZERO image-generation credits: nothing here calls /v2/generate.
// Spends ~0.1 plan credits (one background removal ≈ 76 transformations + a few uploads), then deletes everything it made.
// Never prints secrets. Reads CLOUDINARY_URL (or the three split vars) from .env.local.
//
// Usage: node scripts/free-tier-checks.mjs

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";

const TEST_IMAGE = "https://res.cloudinary.com/demo/image/upload/samples/ecommerce/leather-bag-gray.jpg";
const FOLDER = "realstage/checks";
const TAG = "realstage-check";
const CUTOUT = "e_background_removal/e_trim/f_png"; // canonical cutout string (Round 3, R3-1)

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (!m) throw new Error("CLOUDINARY_URL is not in cloudinary://key:secret@cloud form");
    return { key: m[1], secret: m[2], cloud: m[3] };
  }
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) throw new Error("Missing credentials: create .env.local (see .env.example)");
  return { cloud, key, secret };
}

const C = loadEnv();
const API = `https://api.cloudinary.com/v1_1/${C.cloud}`;
const DELIVERY = `https://res.cloudinary.com/${C.cloud}/image/upload`;
const basic = "Basic " + Buffer.from(`${C.key}:${C.secret}`).toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (id, name, pass, detail) => {
  results.push({ id, name, pass, detail });
  console.log(`${pass === true ? "PASS" : pass === false ? "FAIL" : "INFO"}  #${id} ${name} — ${detail}`);
};

function sign(params) {
  const toSign = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== "")
    .sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(toSign + C.secret).digest("hex");
}

async function upload(file, params, resourceType = "image") {
  const p = { ...params, timestamp: Math.floor(Date.now() / 1000) };
  const body = new FormData();
  for (const [k, v] of Object.entries(p)) body.append(k, String(v));
  body.append("api_key", C.key);
  body.append("signature", sign(p));
  body.append("file", file);
  const res = await fetch(`${API}/${resourceType}/upload`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function admin(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: basic, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// PNG colour type lives at byte 25 of the file; 6 = RGBA, 4 = grey+alpha.
function pngHasAlpha(buf) {
  return buf.length > 26 && buf.toString("ascii", 1, 4) === "PNG" && (buf[25] === 6 || buf[25] === 4);
}

async function check2Cutout() {
  const up = await upload(TEST_IMAGE, { folder: FOLDER, tags: TAG, public_id: `orig-${randomUUID().slice(0, 8)}` });
  if (up.status !== 200) return record(2, "Background removal pipeline", false, `original upload failed: HTTP ${up.status} ${up.json?.error?.message ?? ""}`);
  const id = up.json.public_id;
  const derived = `${DELIVERY}/${CUTOUT}/${id}.png`;
  let res, tries = 0;
  for (; tries < 20; tries++) {
    res = await fetch(derived);
    if (res.status !== 423 && res.status !== 420) break;
    await sleep(3000);
  }
  if (res.status !== 200) {
    return record(2, "Background removal pipeline", false,
      `derived ${CUTOUT} returned HTTP ${res.status} (${res.headers.get("x-cld-error") ?? "no x-cld-error"}) after ${tries} retries — replan cutout (plan Budget Lock check 2)`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const cut = await upload(derived, { folder: FOLDER, tags: TAG, public_id: `${id.split("/").pop()}_cut` });
  if (cut.status !== 200) return record(2, "Background removal pipeline", false, `materializing _cut failed: HTTP ${cut.status} ${cut.json?.error?.message ?? ""}`);
  record(2, "Background removal pipeline", pngHasAlpha(buf) && cut.json.format === "png",
    `original ${up.json.width}×${up.json.height} → _cut ${cut.json.width}×${cut.json.height} ${cut.json.format}, alpha=${pngHasAlpha(buf)}, 423 retries=${tries}`);
  return { id, cutId: cut.json.public_id };
}

async function check3Metadata() {
  const ext = `rs_check_${Date.now()}`;
  const made = await admin("POST", "/metadata_fields", { type: "string", external_id: ext, label: "RealStage check" });
  if (made.status !== 200) return record(3, "Structured metadata", false, `create field HTTP ${made.status} ${made.json?.error?.message ?? ""}`);
  const del = await admin("DELETE", `/metadata_fields/${ext}`);
  record(3, "Structured metadata", true, `created + deleted test field (delete HTTP ${del.status})`);
}

async function check4Downloads(ids) {
  if (!ids) return record(4, "Downloads (fl_attachment + CORS)", false, "skipped: no asset from check 2");
  const url = `${DELIVERY}/fl_attachment:realstage-check/${ids.cutId}.png`;
  const res = await fetch(url, { headers: { Origin: "https://realstage.vercel.app" } });
  const cd = res.headers.get("content-disposition") ?? "";
  const acao = res.headers.get("access-control-allow-origin") ?? "";
  record(4, "Downloads (fl_attachment + CORS)", res.status === 200 && cd.includes("attachment") && acao === "*",
    `HTTP ${res.status}, content-disposition="${cd}", access-control-allow-origin="${acao}"`);
}

async function check5Usage() {
  const u = await admin("GET", "/usage");
  if (u.status !== 200) return record(5, "Usage baseline", false, `HTTP ${u.status}`);
  const c = u.json.credits ?? {};
  record(5, "Usage baseline", true, `plan=${u.json.plan}, credits used=${c.usage ?? "?"} of ${c.limit ?? "?"} (${c.used_percent ?? "?"}%), transformations=${u.json.transformations?.usage ?? "?"}`);
}

async function check6Slots() {
  const pid = `${FOLDER}/slot-${randomUUID().slice(0, 8)}`;
  const tiny = "data:text/plain;base64," + Buffer.from("1").toString("base64");
  const runs = await Promise.all(Array.from({ length: 8 }, () =>
    upload(tiny, { public_id: pid, overwrite: "false", tags: TAG }, "raw")));
  const ok = runs.filter((r) => r.status === 200);
  const winners = ok.filter((r) => !r.json.existing);
  record(6, "Slot atomicity (create-if-absent race)", ok.length === 8 && winners.length === 1,
    `8 parallel uploads → ${ok.length} HTTP 200, ${winners.length} created, ${ok.length - winners.length} existing:true` +
    (winners.length !== 1 ? " — FAILS: set LIVE_AI=off in production (plan X3 fallback)" : ""));
}

async function cleanup() {
  const a = await admin("DELETE", `/resources/image/tags/${TAG}?invalidate=true`);
  const b = await admin("DELETE", `/resources/raw/tags/${TAG}?invalidate=true`);
  console.log(`cleanup: image tag delete HTTP ${a.status}, raw tag delete HTTP ${b.status}`);
}

console.log(`RealStage free-tier checks on cloud "${C.cloud}" (secrets not printed)\n`);
record(1, "Model credit costs", null, "manual: Console → Image Generation → Model → Change; note credits per model at 1K/2K");
try {
  const ids = await check2Cutout().catch((e) => record(2, "Background removal pipeline", false, e.message));
  await check3Metadata().catch((e) => record(3, "Structured metadata", false, e.message));
  await check4Downloads(ids && ids.cutId ? ids : null).catch((e) => record(4, "Downloads", false, e.message));
  await check5Usage().catch((e) => record(5, "Usage baseline", false, e.message));
  await check6Slots().catch((e) => record(6, "Slot atomicity", false, e.message));
} finally {
  await cleanup().catch((e) => console.log("cleanup error:", e.message));
}

mkdirSync("docs", { recursive: true });
const md = ["# Free-tier checks", "", `Run: ${new Date().toISOString()} · cloud: ${C.cloud}`, "",
  "| # | Check | Result | Detail |", "|---|---|---|---|",
  ...results.map((r) => `| ${r.id} | ${r.name} | ${r.pass === true ? "PASS" : r.pass === false ? "FAIL" : "manual"} | ${r.detail.replace(/\|/g, "\\|")} |`)].join("\n");
writeFileSync("docs/free-tier-checks.md", md + "\n");
console.log("\nWrote docs/free-tier-checks.md");
process.exitCode = results.some((r) => r.pass === false) ? 1 : 0;
