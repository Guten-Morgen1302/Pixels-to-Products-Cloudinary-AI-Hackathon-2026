// Real-account pipeline smoke (T-E11). Zero generation credits: uses a pre-cut sample + a library stage.
//   npm run smoke
import "./env";
import sharp from "sharp";
import { createCloud } from "../lib/cloud";
import { makeCutout } from "../lib/services/cutout";
import { makeKit } from "../lib/services/kit";
import { libraryStages } from "../lib/services/stages";
import { compositePreviewUrl } from "../lib/urls";

const port = createCloud();
const SID = "0".repeat(24);
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

(async () => {
  const samples = (await port.listTag("sample")).filter((a) => !/_(cut|core)$/.test(a.publicId));
  check("samples exist", samples.length > 0, `${samples.length} found (run npm run setup)`);
  const { stages, source } = await libraryStages(port);
  check("library stages exist", stages.length > 0, `${stages.length} (${source})`);
  if (!samples.length || !stages.length) process.exit(1);

  const cut = await makeCutout(port, SID, samples[0].publicId);
  check("sample cutout ready (no cutout budget)", cut.cut.w > 0, `${cut.cut.w}×${cut.cut.h}`);
  const preview = await port.fetchBuffer(compositePreviewUrl(port.cloud, stages[0], cut.cut));
  check("composite preview renders", preview.status === 200, `HTTP ${preview.status} ${preview.error ?? ""}`);

  const kit = await makeKit(port, SID, { stage: { ...stages[0] }, cut: cut.cut, productName: "smoke test" });
  for (const f of kit.files) {
    const r = await port.fetchBuffer(f.download);
    const meta = r.status === 200 ? await sharp(r.buf).metadata() : null;
    check(`kit ${f.key} downloads`, r.status === 200 && meta?.format === "jpeg", `HTTP ${r.status} ${meta ? `${meta.width}×${meta.height} ${meta.format}` : r.error ?? ""}`);
    if (f.key === "amazon" && meta) check("amazon is 2000×2000", meta.width === 2000 && meta.height === 2000);
  }
  check("amazon background is pure white", kit.amazonOk);
  await port.destroy(kit.finalId).catch(() => undefined);
  console.log(failures ? `\n${failures} check(s) failed` : "\nsmoke passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("smoke crashed:", e?.error?.message ?? e?.message ?? e);
  process.exit(1);
});
