// Credit + quota guard (plan: Budget Lock, Outside Voice X2/X3/X6/X8).
//
// Slots are 1-byte raw assets with fixed public IDs. Claiming = upload with overwrite:false; Cloudinary reports
// `existing` when the ID is taken, so two concurrent claims can never both win (verified by free check #6).
//
//   global pools                                   per-visitor caps (keyed by a hash of the client IP)
//   prod   realstage/ledger/prod-01 … -15           realstage/ledger/v/<ip>/gen-1 … -6     (AI credits)
//   sign   realstage/ledger/sign-001 … -200         realstage/ledger/v/<ip>/sign-01 … -12  (uploads)
//   cutout realstage/ledger/cut-001 … -100          realstage/ledger/v/<ip>/cut-01 … -10   (background removals)
//
// Per-visitor caps run first, so one visitor (or a curl loop minting fresh sessions) cannot drain a shared pool.
// A claim that wins only part of what it needs releases what it won (no leaked slots).
// Every check fails closed: any error -> paused.
import { BUDGET } from "./models";
import type { CloudPort } from "./cloud";
import type { Config } from "./config";

export type Pool = { prefix: string; size: number; pad: number };
export const POOLS = {
  prod: { prefix: "realstage/ledger/prod", size: BUDGET.prodPool, pad: 2 },
  sign: { prefix: "realstage/ledger/sign", size: BUDGET.uploadSignPool, pad: 3 },
  cutout: { prefix: "realstage/ledger/cut", size: BUDGET.cutoutPool, pad: 3 },
} satisfies Record<string, Pool>;

export const VISITOR_CAPS = { gen: 6, sign: 12, cut: 10 } as const;
export const visitorPool = (visitor: string, kind: keyof typeof VISITOR_CAPS): Pool => ({
  prefix: `realstage/ledger/v/${visitor}/${kind}`,
  size: VISITOR_CAPS[kind],
  pad: 2,
});

const QUOTA_ID = "realstage/ledger/quota";
const LEDGER_TAG = "realstage-ledger";
const PLAN_CREDIT_STOP = 20; // of 25 Free-plan credits (X8 backstop)

const slotId = (p: Pool, i: number) => `${p.prefix}-${String(i).padStart(p.pad, "0")}`;

async function taken(port: CloudPort, pool: Pool): Promise<Set<string>> {
  return new Set(await port.listPrefix(`${pool.prefix}-`, "raw"));
}

export async function slotsUsed(port: CloudPort, pool: Pool): Promise<number> {
  return (await taken(port, pool)).size;
}

// Claims n slots atomically-per-slot. Returns the won IDs, or null (after releasing partial wins) if fewer than n were won.
export async function claimSlots(port: CloudPort, pool: Pool, n: number, known?: Set<string>): Promise<string[] | null> {
  const seen = known ?? (await taken(port, pool));
  if (pool.size - seen.size < n) return null;
  const won: string[] = [];
  for (let i = 1; i <= pool.size && won.length < n; i++) {
    const id = slotId(pool, i);
    if (seen.has(id)) continue;
    if ((await port.createIfAbsent(id, [LEDGER_TAG])) === "created") won.push(id);
  }
  if (won.length === n) return won;
  await releaseSlots(port, won);
  return null;
}

export async function releaseSlots(port: CloudPort, ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => port.destroy(id, "raw").catch(() => undefined)));
}

// Claims from the visitor cap first, then the global pool; releases the visitor claim if the global claim fails.
async function claimScoped(port: CloudPort, visitor: string, kind: keyof typeof VISITOR_CAPS, global: Pool, n: number, knownGlobal?: Set<string>): Promise<"ok" | "visitor" | "global"> {
  const mine = await claimSlots(port, visitorPool(visitor, kind), n);
  if (!mine) return "visitor";
  const shared = await claimSlots(port, global, n, knownGlobal);
  if (!shared) {
    await releaseSlots(port, mine);
    return "global";
  }
  return "ok";
}

// Quota marker: Cloudinary's own remaining-credit count, written only when it changes (Admin API budget, 500/h).
let lastQuotaWritten: number | undefined;
let quotaMarkerExists = false;

export async function readQuota(port: CloudPort): Promise<number | undefined> {
  const r = await port.getResource(QUOTA_ID, "raw"); // 404 -> null (unknown); any other error propagates -> fail closed
  const v = Number(r?.context?.remaining);
  return r?.context?.remaining !== undefined && Number.isFinite(v) ? v : undefined;
}

export async function recordQuota(port: CloudPort, remaining: number | undefined): Promise<void> {
  if (remaining === undefined || remaining === lastQuotaWritten) return;
  try {
    if (!quotaMarkerExists) {
      await port.createIfAbsent(QUOTA_ID, [LEDGER_TAG]);
      quotaMarkerExists = true;
    }
    await port.update(QUOTA_ID, { context: { remaining: String(remaining), at: new Date().toISOString() } }, "raw");
    lastQuotaWritten = remaining;
  } catch {
    /* best effort: the ledger cap still holds */
  }
}

export type AiStatus = { on: boolean; creditsLeft: number; reason?: "disabled" | "cap" | "quota" | "error"; mock: boolean };

let cache: { at: number; value: AiStatus } | null = null;

async function computeStatus(port: CloudPort, cfg: Config): Promise<{ status: AiStatus; seen?: Set<string> }> {
  if (!cfg.liveAi) return { status: { on: false, creditsLeft: 0, reason: "disabled", mock: false } };
  try {
    const seen = await taken(port, POOLS.prod);
    const left = BUDGET.prodPool - seen.size;
    const quota = await readQuota(port);
    if (left <= 0) return { status: { on: false, creditsLeft: 0, reason: "cap", mock: false } };
    if (quota !== undefined && quota <= BUDGET.quotaFloor) return { status: { on: false, creditsLeft: 0, reason: "quota", mock: false } };
    return { status: { on: true, creditsLeft: left, mock: false }, seen };
  } catch {
    return { status: { on: false, creditsLeft: 0, reason: "error", mock: false } };
  }
}

export async function aiStatus(port: CloudPort, cfg: Config, { fresh = false } = {}): Promise<AiStatus> {
  if (cfg.genMode === "mock") return { on: true, creditsLeft: BUDGET.prodPool, mock: true };
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.value;
  const { status } = await computeStatus(port, cfg);
  cache = { at: Date.now(), value: status };
  return status;
}

export function resetBudgetCache() {
  cache = null;
  usageCache = null;
  lastQuotaWritten = undefined;
  quotaMarkerExists = false;
}

export type Reserve = { ok: true } | { ok: false; code: "BUDGET_PAUSED"; reason: string };
const paused = (reason: string): Reserve => ({ ok: false, code: "BUDGET_PAUSED", reason });

export async function reserveGeneration(port: CloudPort, cfg: Config, credits: number, visitor: string): Promise<Reserve> {
  if (cfg.genMode === "mock") return { ok: true };
  const { status, seen } = await computeStatus(port, cfg);
  if (!status.on) return paused(status.reason ?? "paused");
  if (status.creditsLeft < credits) return paused("cap");
  try {
    const r = await claimScoped(port, visitor, "gen", POOLS.prod, credits, seen);
    cache = null;
    return r === "ok" ? { ok: true } : paused(r === "visitor" ? "visitor-cap" : "cap");
  } catch {
    return paused("error");
  }
}

// Called with Cloudinary's real `used_by_request` once a task finishes: claim the difference if a model cost more
// than the 1 credit reserved up front, so the ledger tracks real spend (best effort; the quota floor backstops it).
export async function settleCost(port: CloudPort, used: number | undefined, reserved: number): Promise<void> {
  if (used === undefined || used <= reserved) return;
  await claimSlots(port, POOLS.prod, Math.min(used - reserved, BUDGET.prodPool)).catch(() => null);
  cache = null;
}

let usageCache: { at: number; used: number } | null = null;

async function planCreditsUsed(port: CloudPort): Promise<number> {
  if (usageCache && Date.now() - usageCache.at < 5 * 60_000) return usageCache.used;
  const u = await port.usage();
  usageCache = { at: Date.now(), used: u.creditsUsed };
  return u.creditsUsed;
}

export async function reserveUpload(port: CloudPort, cfg: Config, visitor: string): Promise<Reserve> {
  if (!cfg.liveUploads) return paused("uploads-off");
  try {
    if ((await planCreditsUsed(port)) >= PLAN_CREDIT_STOP) return paused("plan");
    const r = await claimScoped(port, visitor, "sign", POOLS.sign, 1);
    return r === "ok" ? { ok: true } : paused(r === "visitor" ? "visitor-cap" : "cap");
  } catch {
    return paused("error");
  }
}

export async function reserveCutout(port: CloudPort, visitor: string): Promise<Reserve> {
  try {
    const r = await claimScoped(port, visitor, "cut", POOLS.cutout, 1);
    return r === "ok" ? { ok: true } : paused(r === "visitor" ? "visitor-cap" : "cap");
  } catch {
    return paused("error");
  }
}
