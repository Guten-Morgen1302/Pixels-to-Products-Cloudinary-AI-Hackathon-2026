// Every Cloudinary transformation string lives here (Eng review: one builder, exact strings pinned by tests).
// Pure functions: safe to import from client components.

import { cropWindow, placeProduct, shadowBox, type Box, type Geometry, type Size } from "./geometry";

export const SHADOW_ASSET = "realstage/assets/contact-shadow";
export const CUTOUT_TRANSFORM = "e_background_removal/e_trim/f_png"; // canonical (Round 3, R3-1)

export type StageRef = { publicId: string; w: number; h: number; geometry: Geometry };
export type CutRef = { publicId: string; w: number; h: number };

const layer = (publicId: string) => publicId.replace(/\//g, ":");
const base = (cloud: string) => `https://res.cloudinary.com/${cloud}/image/upload`;

export function deliveryUrl(cloud: string, publicId: string, transforms: string[] = []): string {
  const t = transforms.filter(Boolean).join("/");
  return `${base(cloud)}/${t ? t + "/" : ""}${publicId}`;
}

export function cutoutSourceUrl(cloud: string, originalId: string): string {
  return deliveryUrl(cloud, originalId, [CUTOUT_TRANSFORM]);
}

export function compositeTransforms(stage: StageRef, cut: CutRef): { transforms: string[]; place: Box } {
  const size: Size = { w: stage.w, h: stage.h };
  const place = placeProduct(size, cut, stage.geometry);
  const sh = shadowBox(place, size);
  return {
    place,
    transforms: [
      `c_scale,w_${stage.w},h_${stage.h}`,
      `l_${layer(SHADOW_ASSET)},c_scale,w_${sh.w},h_${sh.h},o_55`,
      `fl_layer_apply,g_north_west,x_${sh.x},y_${sh.y}`,
      `l_${layer(cut.publicId)},c_scale,w_${place.w},h_${place.h}`,
      `fl_layer_apply,g_north_west,x_${place.x},y_${place.y}`,
    ],
  };
}

export function compositePreviewUrl(cloud: string, stage: StageRef, cut: CutRef, width = 1024): string {
  const { transforms } = compositeTransforms(stage, cut);
  return deliveryUrl(cloud, stage.publicId, [...transforms, `c_scale,w_${width}`, "f_auto,q_auto"]);
}

// Source for materializing the chosen composite as its own asset (relight input / kit base).
export function compositeSourceUrl(cloud: string, stage: StageRef, cut: CutRef): string {
  const { transforms } = compositeTransforms(stage, cut);
  return deliveryUrl(cloud, stage.publicId, [...transforms, "f_jpg,q_95"]);
}

// Pixel-Lock: relit output resized to the composite's size, original-pixel core layered back at the same geometry.
export function pixelLockSourceUrl(cloud: string, relitId: string, stage: StageRef, cut: CutRef, coreId: string): string {
  const place = placeProduct({ w: stage.w, h: stage.h }, cut, stage.geometry);
  return deliveryUrl(cloud, relitId, [
    `c_scale,w_${stage.w},h_${stage.h}`,
    `l_${layer(coreId)},c_scale,w_${place.w},h_${place.h}`,
    `fl_layer_apply,g_north_west,x_${place.x},y_${place.y}`,
    "f_jpg,q_95",
  ]);
}

// Compare panel (X13): the cutout's original pixels vs the same region of the stage, at identical scale.
// `stageImageId` is the composite's stage, or the materialized relit final when one exists.
export function comparePair(cloud: string, stage: StageRef, cut: CutRef, relitFinalId?: string) {
  const { transforms, place } = compositeTransforms(stage, cut);
  const crop = `c_crop,g_north_west,x_${place.x},y_${place.y},w_${place.w},h_${place.h}`;
  return {
    yours: deliveryUrl(cloud, cut.publicId, [`c_scale,w_${place.w},h_${place.h}`, "b_rgb:F5F6F8", "f_auto,q_auto"]),
    staged: relitFinalId
      ? deliveryUrl(cloud, relitFinalId, [crop, "f_auto,q_auto"])
      : deliveryUrl(cloud, stage.publicId, [...transforms, crop, "f_auto,q_auto"]),
  };
}

export type KitFile = { key: "amazon" | "instagram" | "story" | "whatsapp"; label: string; size: string; social: boolean; download: string; preview: string };

// Display name for the product: the upload's filename without its extension (never blank).
export function productLabel(name: string): string {
  const label = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  return label || name;
}

export function slugify(name: string): string {
  const s = name.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || "product";
}

// Kit outputs (Eng R2-22, Round 2 X10). Downloads use explicit JPG, never f_auto.
export function kitFiles(cloud: string, final: { publicId: string; w: number; h: number; anchorX: number }, cutId: string, productName: string): KitFile[] {
  const slug = `realstage-${slugify(productName)}`;
  const att = (name: string) => `fl_attachment:${name}`;
  const fin = layer(final.publicId);
  const twoK = final.w >= 2000;

  const social = (w: number, h: number): string[] => {
    if (twoK) {
      const c = cropWindow({ w: final.w, h: final.h }, w / h, final.anchorX);
      return [`c_crop,g_north_west,x_${c.x},y_${c.y},w_${c.w},h_${c.h}`, `c_scale,w_${w},h_${h}`];
    }
    // 1K: stage at native pixels over a blurred backdrop (b_blurred is video-only, verified 2026-10-01).
    return [`c_fill,w_${w},h_${h},e_blur:1500`, `l_${fin},c_limit,w_${w},h_${h}`, "fl_layer_apply,g_center"];
  };

  // c_pad fits the product inside 1700² (85%); c_mpad then pads to 2000² WITHOUT scaling back up (c_pad would).
  const amazon = ["c_pad,w_1700,h_1700,b_white", "c_mpad,w_2000,h_2000,b_white", "f_jpg,q_95"];
  const files: Array<[KitFile["key"], string, string, boolean, string, string[]]> = [
    ["amazon", "Amazon main · white", "2000×2000", false, cutId, amazon],
    ["instagram", "Instagram post", "1080×1350", !twoK, final.publicId, [...social(1080, 1350), "f_jpg,q_90"]],
    ["story", "Story / Reel cover", "1080×1920", !twoK, final.publicId, [...social(1080, 1920), "f_jpg,q_90"]],
    ["whatsapp", "WhatsApp / Meesho", "1080×1080", !twoK, final.publicId, [...social(1080, 1080), "f_jpg,q_90"]],
  ];
  const suffix: Record<KitFile["key"], string> = { amazon: "amazon-2000", instagram: "instagram-1080x1350", story: "story-1080x1920", whatsapp: "whatsapp-1080" };

  return files.map(([key, label, size, isSocial, id, t]) => ({
    key,
    label,
    size,
    social: isSocial,
    download: deliveryUrl(cloud, id, [...t, att(`${slug}-${suffix[key]}`)]),
    preview: deliveryUrl(cloud, id, [...t.filter((x) => !x.startsWith("f_jpg")), "c_scale,w_88", "f_auto,q_auto"]),
  }));
}
