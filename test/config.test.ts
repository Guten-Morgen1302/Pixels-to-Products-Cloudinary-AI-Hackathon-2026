import { describe, expect, it } from "vitest";
import { getConfig } from "@/lib/config";

const base = { CLOUDINARY_URL: "cloudinary://k:s@c", SESSION_SECRET: "x".repeat(32) };

describe("getConfig flags", () => {
  it("accepts dashboard-pasted values with spaces or capitals", () => {
    const cfg = getConfig({ ...base, GEN_MODE: " Live\r", LIVE_AI: "ON ", LIVE_UPLOADS: " on" } as NodeJS.ProcessEnv);
    expect(cfg.genMode).toBe("live");
    expect(cfg.liveAi).toBe(true);
    expect(cfg.liveUploads).toBe(true);
  });

  it("anything other than live stays mock (fail safe: 0 credits)", () => {
    for (const v of [undefined, "", "mock", "lve", "production"]) {
      expect(getConfig({ ...base, GEN_MODE: v } as NodeJS.ProcessEnv).genMode).toBe("mock");
    }
    expect(getConfig({ ...base, LIVE_UPLOADS: " OFF" } as NodeJS.ProcessEnv).liveUploads).toBe(false);
  });
});
