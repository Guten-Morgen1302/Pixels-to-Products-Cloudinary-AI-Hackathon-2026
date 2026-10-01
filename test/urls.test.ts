import { describe, expect, it } from "vitest";
import { comparePair, compositePreviewUrl, compositeSourceUrl, cutoutSourceUrl, kitFiles, pixelLockSourceUrl, slugify } from "@/lib/urls";

const stage = { publicId: "realstage/lib/kota-flux", w: 1024, h: 1024, geometry: { anchorX: 0.5, floorY: 0.8, maxW: 0.5, maxH: 0.6 } };
const cut = { publicId: "realstage/u/abc/p1_cut", w: 500, h: 500 };

describe("transformation strings (golden)", () => {
  it("cutout uses the one canonical string with e_trim", () => {
    expect(cutoutSourceUrl("c", "realstage/u/abc/p1")).toBe("https://res.cloudinary.com/c/image/upload/e_background_removal/e_trim/f_png/realstage/u/abc/p1");
  });

  it("composite: stage size, shadow layer then product layer at placed geometry", () => {
    expect(compositeSourceUrl("c", stage, cut)).toBe(
      "https://res.cloudinary.com/c/image/upload/c_scale,w_1024,h_1024/l_realstage:assets:contact-shadow,c_scale,w_563,h_61,o_55/fl_layer_apply,g_north_west,x_231,y_789/l_realstage:u:abc:p1_cut,c_scale,w_512,h_512/fl_layer_apply,g_north_west,x_256,y_307/f_jpg,q_95/realstage/lib/kota-flux",
    );
    expect(compositePreviewUrl("c", stage, cut)).toMatch(/\/c_scale,w_1024\/f_auto,q_auto\/realstage\/lib\/kota-flux$/);
  });

  it("pixel-lock layers the core at the same geometry as the cut", () => {
    expect(pixelLockSourceUrl("c", "realstage/stages/relit1", stage, cut, "realstage/u/abc/p1_core")).toBe(
      "https://res.cloudinary.com/c/image/upload/c_scale,w_1024,h_1024/l_realstage:u:abc:p1_core,c_scale,w_512,h_512/fl_layer_apply,g_north_west,x_256,y_307/f_jpg,q_95/realstage/stages/relit1",
    );
  });

  it("compare crops both sides to the same box", () => {
    const p = comparePair("c", stage, cut);
    expect(p.yours).toContain("c_scale,w_512,h_512");
    expect(p.staged).toContain("c_crop,g_north_west,x_256,y_307,w_512,h_512");
  });
});

describe("kit", () => {
  const final = { publicId: "realstage/u/abc/final-1", w: 1024, h: 1024, anchorX: 0.5 };
  const files = kitFiles("c", final, cut.publicId, "Steel Tumbler.jpg");

  it("has 4 files with explicit JPG downloads, never f_auto", () => {
    expect(files.map((f) => f.key)).toEqual(["amazon", "instagram", "story", "whatsapp"]);
    for (const f of files) {
      expect(f.download).not.toContain("f_auto");
      expect(f.download).toMatch(/f_jpg,q_9[05]\/fl_attachment:realstage-steel-tumbler-/);
    }
  });

  it("Amazon pads to 85% then 2000 white, from the cutout", () => {
    expect(files[0].download).toBe(
      "https://res.cloudinary.com/c/image/upload/c_pad,w_1700,h_1700,b_white/c_mpad,w_2000,h_2000,b_white/f_jpg,q_95/fl_attachment:realstage-steel-tumbler-amazon-2000/realstage/u/abc/p1_cut",
    );
  });

  it("1K stages use the blurred-backdrop recipe (no b_blurred) and are labelled social", () => {
    const ig = files[1];
    expect(ig.social).toBe(true);
    expect(ig.download).toContain("c_fill,w_1080,h_1350,e_blur:1500/l_realstage:u:abc:final-1,c_limit,w_1080,h_1350/fl_layer_apply,g_center");
    expect(ig.download).not.toContain("b_blurred");
  });

  it("2K stages crop around the anchor instead", () => {
    const big = kitFiles("c", { ...final, w: 2048, h: 2048 }, cut.publicId, "x");
    expect(big[2].download).toContain("c_crop,g_north_west,x_448,y_0,w_1152,h_2048/c_scale,w_1080,h_1920");
    expect(big[2].social).toBe(false);
  });

  it("slugify", () => {
    expect(slugify("IMG_2041.HEIC")).toBe("img-2041");
    expect(slugify("!!!")).toBe("product");
  });
});

// Regression: ISSUE-002 — studio showed "qa-real-photo.jpg" as the product name
// Found by /qa on 2026-10-01
// Report: .gstack/qa-reports/run-20261001T134854Z/qa-report-localhost-2026-10-01.md
describe("productLabel (ISSUE-002)", () => {
  it("drops the file extension for display, keeps everything else", async () => {
    const { productLabel } = await import("@/lib/urls");
    expect(productLabel("qa-real-photo.jpg")).toBe("qa-real-photo");
    expect(productLabel("IMG_2041.HEIC")).toBe("IMG_2041");
    expect(productLabel("Leather bag")).toBe("Leather bag"); // sample names have no extension
    expect(productLabel("my.steel.tumbler.png")).toBe("my.steel.tumbler");
    expect(productLabel(".jpg")).toBe(".jpg"); // never blank
  });
});
