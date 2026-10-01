import { randomUUID } from "node:crypto";
import type { CloudPort } from "../cloud";
import { whiteCheck } from "../image-checks";
import { expTag, ownsAsset, sessionFolder } from "../session";
import { compositeSourceUrl, deliveryUrl, kitFiles, type CutRef, type KitFile, type StageRef } from "../urls";
import { AppError, MESSAGES } from "./errors";

export type KitInput = { stage: StageRef & { name: string; model: string }; cut: CutRef; relitFinalId?: string; productName: string; alignment?: number | null };
export type KitResult = { finalId: string; files: KitFile[]; amazonOk: boolean };

// Structured metadata fields created by scripts/setup.ts (CEO-D5). Missing fields never block the kit.
async function tagFinal(port: CloudPort, finalId: string, input: KitInput) {
  await port
    .update(finalId, {
      metadata: {
        rs_product_name: input.productName.slice(0, 80),
        rs_stage_model: input.stage.model,
        rs_pixel_locked: "yes",
        ...(input.alignment != null ? { rs_alignment: String(input.alignment) } : {}),
      },
    })
    .catch(() => undefined);
}

// Materialize the chosen look as `final`, then derive the 4 kit files as fl_attachment URLs of it (X4, X7):
// kit files are not stored assets, so deleting `final` (exp tag) deletes them too.
export async function makeKit(port: CloudPort, sessionId: string, input: KitInput): Promise<KitResult> {
  if (!ownsAsset(sessionId, input.cut?.publicId ?? "") || !input.stage?.publicId?.startsWith("realstage/")) {
    throw new AppError("FORBIDDEN", MESSAGES.FORBIDDEN, 403);
  }
  if (input.relitFinalId && !ownsAsset(sessionId, input.relitFinalId)) throw new AppError("FORBIDDEN", MESSAGES.FORBIDDEN, 403);

  const tags = ["realstage", `session-${sessionId}`, expTag()];
  let finalId = input.relitFinalId;
  if (!finalId) {
    finalId = `${sessionFolder(sessionId)}/final-${randomUUID().slice(0, 12)}`;
    await port.uploadFromUrl(compositeSourceUrl(port.cloud, input.stage, input.cut), { publicId: finalId, tags });
  }
  await tagFinal(port, finalId, input);

  const files = kitFiles(port.cloud, { publicId: finalId, w: input.stage.w, h: input.stage.h, anchorX: input.stage.geometry.anchorX }, input.cut.publicId, input.productName);
  const amazon = files.find((f) => f.key === "amazon")!;
  const [jpg, cut] = await Promise.all([
    port.fetchBuffer(amazon.download.replace(/\/fl_attachment:[^/]+/, "")),
    port.fetchBuffer(deliveryUrl(port.cloud, input.cut.publicId, ["f_png"])),
  ]);
  let amazonOk = false;
  if (jpg.status === 200 && cut.status === 200) amazonOk = (await whiteCheck(jpg.buf, cut.buf)).ok;
  return { finalId, files, amazonOk };
}
