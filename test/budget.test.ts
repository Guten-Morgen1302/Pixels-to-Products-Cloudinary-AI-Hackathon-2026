import { beforeEach, describe, expect, it } from "vitest";
import { aiStatus, claimSlots, POOLS, recordQuota, reserveCutout, reserveGeneration, reserveUpload, resetBudgetCache } from "@/lib/budget";
import { getConfig } from "@/lib/config";
import { fakeCloud } from "./fake-cloud";

const live = { ...getConfig(), genMode: "live" as const, liveAi: true };

beforeEach(() => resetBudgetCache());

describe("slot ledger", () => {
  it("two concurrent claims for the last slot: exactly one wins", async () => {
    const c = fakeCloud();
    for (let i = 1; i <= 14; i++) c.raw.add(`realstage/ledger/prod-${String(i).padStart(2, "0")}`);
    const [a, b] = await Promise.all([claimSlots(c, POOLS.prod, 1), claimSlots(c, POOLS.prod, 1)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(c.raw.size).toBe(15);
  });

  it("refuses a fan-out when fewer than 3 slots remain, without claiming any", async () => {
    const c = fakeCloud();
    for (let i = 1; i <= 13; i++) c.raw.add(`realstage/ledger/prod-${String(i).padStart(2, "0")}`);
    expect(await claimSlots(c, POOLS.prod, 3)).toBe(false);
    expect(c.raw.size).toBe(13);
  });
});

describe("generation reservation", () => {
  it("mock mode spends nothing", async () => {
    const c = fakeCloud();
    expect(await reserveGeneration(c, { ...live, genMode: "mock" }, 3)).toEqual({ ok: true });
    expect(c.raw.size).toBe(0);
  });

  it("LIVE_AI=off pauses generation", async () => {
    const r = await reserveGeneration(fakeCloud(), { ...live, liveAi: false }, 1);
    expect(r).toMatchObject({ ok: false, code: "BUDGET_PAUSED", reason: "disabled" });
  });

  it("claims credits under the cap and stops at 15", async () => {
    const c = fakeCloud();
    for (let i = 0; i < 5; i++) expect((await reserveGeneration(c, live, 3)).ok).toBe(true);
    expect(await reserveGeneration(c, live, 1)).toMatchObject({ ok: false, reason: "cap" });
  });

  it("quota trip-wire: remaining <= 6 pauses even with ledger room", async () => {
    const c = fakeCloud();
    await recordQuota(c, 6);
    expect(await reserveGeneration(c, live, 1)).toMatchObject({ ok: false, reason: "quota" });
  });

  it("fails closed when the counter lookup errors", async () => {
    const c = fakeCloud();
    c.failListing = true;
    expect((await aiStatus(c, live, { fresh: true })).reason).toBe("error");
    expect((await reserveGeneration(c, live, 1)).ok).toBe(false);
  });
});

describe("upload + cutout pools", () => {
  it("uploads pause at 20/25 plan credits and when LIVE_UPLOADS=off", async () => {
    const c = fakeCloud();
    c.usageCredits = 20;
    expect(await reserveUpload(c, live)).toMatchObject({ ok: false, reason: "plan" });
    resetBudgetCache();
    expect(await reserveUpload(fakeCloud(), { ...live, liveUploads: false })).toMatchObject({ ok: false, reason: "uploads-off" });
  });

  it("the 101st cutout is refused", async () => {
    const c = fakeCloud();
    for (let i = 1; i <= 100; i++) c.raw.add(`realstage/ledger/cut-${String(i).padStart(3, "0")}`);
    expect((await reserveCutout(c)).ok).toBe(false);
  });
});
