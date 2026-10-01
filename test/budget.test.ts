import { beforeEach, describe, expect, it } from "vitest";
import { aiStatus, claimSlots, POOLS, recordQuota, reserveCutout, reserveGeneration, reserveUpload, resetBudgetCache, settleCost, VISITOR_CAPS } from "@/lib/budget";
import { getConfig } from "@/lib/config";
import { fakeCloud } from "./fake-cloud";

const live = { ...getConfig(), genMode: "live" as const, liveAi: true };
const prodUsed = (c: ReturnType<typeof fakeCloud>) => [...c.raw].filter((k) => k.startsWith("realstage/ledger/prod-")).length;
const fill = (c: ReturnType<typeof fakeCloud>, prefix: string, n: number, pad: number) => {
  for (let i = 1; i <= n; i++) c.raw.add(`${prefix}-${String(i).padStart(pad, "0")}`);
};

beforeEach(() => resetBudgetCache());

describe("slot ledger", () => {
  it("two concurrent claims for the last slot: exactly one wins", async () => {
    const c = fakeCloud();
    fill(c, "realstage/ledger/prod", 14, 2);
    const [a, b] = await Promise.all([claimSlots(c, POOLS.prod, 1), claimSlots(c, POOLS.prod, 1)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(prodUsed(c)).toBe(15);
  });

  it("refuses a fan-out when fewer than 3 slots remain, without claiming any", async () => {
    const c = fakeCloud();
    fill(c, "realstage/ledger/prod", 13, 2);
    expect(await claimSlots(c, POOLS.prod, 3)).toBeNull();
    expect(prodUsed(c)).toBe(13);
  });

  it("a claim that wins only part of what it needs releases its wins (no leaked slots)", async () => {
    const c = fakeCloud();
    fill(c, "realstage/ledger/prod", 12, 2);
    const stale = new Set(c.raw); // listing taken before a competitor grabbed prod-14 and prod-15
    c.raw.add("realstage/ledger/prod-14");
    c.raw.add("realstage/ledger/prod-15");
    expect(await claimSlots(c, POOLS.prod, 3, stale)).toBeNull();
    expect(c.raw.has("realstage/ledger/prod-13")).toBe(false);
  });
});

describe("generation reservation", () => {
  it("mock mode spends nothing", async () => {
    const c = fakeCloud();
    expect(await reserveGeneration(c, { ...live, genMode: "mock" }, 3, "v1")).toEqual({ ok: true });
    expect(c.raw.size).toBe(0);
  });

  it("LIVE_AI=off pauses generation", async () => {
    expect(await reserveGeneration(fakeCloud(), { ...live, liveAi: false }, 1, "v1")).toMatchObject({ ok: false, code: "BUDGET_PAUSED", reason: "disabled" });
  });

  it("claims credits under the global cap and stops at 15", async () => {
    const c = fakeCloud();
    for (let i = 0; i < 5; i++) expect((await reserveGeneration(c, live, 3, `visitor-${i}`)).ok).toBe(true);
    expect(await reserveGeneration(c, live, 1, "visitor-9")).toMatchObject({ ok: false, reason: "cap" });
    expect(prodUsed(c)).toBe(15);
  });

  it("one visitor cannot drain the shared pool (per-visitor cap)", async () => {
    const c = fakeCloud();
    expect((await reserveGeneration(c, live, 3, "same")).ok).toBe(true);
    expect((await reserveGeneration(c, live, 3, "same")).ok).toBe(true);
    expect(await reserveGeneration(c, live, 1, "same")).toMatchObject({ ok: false, reason: "visitor-cap" });
    expect(prodUsed(c)).toBe(VISITOR_CAPS.gen);
  });

  it("a visitor claim is released when the global pool is exhausted", async () => {
    const c = fakeCloud();
    fill(c, "realstage/ledger/prod", 14, 2);
    expect(await reserveGeneration(c, live, 3, "late")).toMatchObject({ ok: false, reason: "cap" });
    expect([...c.raw].some((k) => k.includes("/v/late/"))).toBe(false);
  });

  it("quota trip-wire: remaining <= 6 pauses even with ledger room", async () => {
    const c = fakeCloud();
    await recordQuota(c, 6);
    expect(await reserveGeneration(c, live, 1, "v1")).toMatchObject({ ok: false, reason: "quota" });
  });

  it("fails closed when the counter lookup errors", async () => {
    const c = fakeCloud();
    c.failListing = true;
    expect((await aiStatus(c, live, { fresh: true })).reason).toBe("error");
    expect((await reserveGeneration(c, live, 1, "v1")).ok).toBe(false);
  });

  it("settleCost claims the difference when a model cost more than reserved", async () => {
    const c = fakeCloud();
    await settleCost(c, 3, 1);
    expect(prodUsed(c)).toBe(2);
    await settleCost(c, 1, 1);
    expect(prodUsed(c)).toBe(2);
  });
});

describe("upload + cutout pools", () => {
  it("uploads pause at 20/25 plan credits and when LIVE_UPLOADS=off", async () => {
    const c = fakeCloud();
    c.usageCredits = 20;
    expect(await reserveUpload(c, live, "v")).toMatchObject({ ok: false, reason: "plan" });
    resetBudgetCache();
    expect(await reserveUpload(fakeCloud(), { ...live, liveUploads: false }, "v")).toMatchObject({ ok: false, reason: "uploads-off" });
  });

  it("the 101st cutout is refused", async () => {
    const c = fakeCloud();
    fill(c, "realstage/ledger/cut", 100, 3);
    expect((await reserveCutout(c, "v")).ok).toBe(false);
  });

  it("per-visitor upload cap", async () => {
    const c = fakeCloud();
    for (let i = 0; i < VISITOR_CAPS.sign; i++) expect((await reserveUpload(c, live, "u")).ok).toBe(true);
    expect(await reserveUpload(c, live, "u")).toMatchObject({ ok: false, reason: "visitor-cap" });
  });
});
