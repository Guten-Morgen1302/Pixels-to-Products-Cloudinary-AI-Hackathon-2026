// Credit + quota guard (plan: Budget Lock, Outside Voice X2/X3/X6/X8).
//
// Slots are 1-byte raw assets with fixed public IDs. Claiming = upload with overwrite:false; Cloudinary reports
// `existing` when the ID is taken, so two concurrent claims can never both win (verified by free check #6).
//
//   prod pool   realstage/ledger/prod-01 … prod-15     1 slot = 1 generation credit (public live AI)
//   sign pool   realstage/ledger/sign-001 … sign-200   1 slot = 1 signed upload
//   cutout pool realstage/ledger/cut-001 … cut-100     1 slot = 1 background removal
//
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

const QUOTA_ID = "realstage/ledger/quota";
const LEDGER_TAG = "realstage-ledger";
const PLAN_CREDIT_STOP = 20; // of 25 Free-plan credits (X8 backstop)

const slotId = (p: Pool, i: number) => `${p.prefix}-${String(i).padStart(p.pad, "0")}`;

export async function slotsUsed(port: CloudPort, pool: Pool): Promise<number> {
  return (await port.listPrefix(`${pool.prefix}-`, "raw")).length;
}

// Claims n slots. Returns true only if all n were won. Already-taken IDs (from the listing hint or a lost race) are skipped.
export async function claimSlots(port: CloudPort, pool: Pool, n: number): Promise<boolean> {
  const taken = new Set(await port.listPrefix(`${pool.prefix}-`, "raw"));
  if (pool.size - taken.size < n) return false;
  let won = 0;
  for (let i = 1; i <= pool.size && won < n; i++) {
    const id = slotId(pool, i);
    if (taken.has(id)) continue;
    if ((await port.createIfAbsent(id, [LEDGER_TAG])) === "created") won++;
  }
  return won === n;
}

export async function readQuota(port: CloudPort): Promise<number | undefined> {
  const r = await port.getResource(QUOTA_ID, "raw").catch(() => null);
  const v = Number(r?.context?.remaining);
  return Number.isFinite(v) && r?.context?.remaining !== undefined ? v : undefined;
}

export async function recordQuota(port: CloudPort, remaining: number | undefined): Promise<void> {
  if (remaining === undefined) return;
  await port.createIfAbsent(QUOTA_ID, [LEDGER_TAG]).catch(() => undefined);
  await port.update(QUOTA_ID, { context: { remaining: String(remaining), at: new Date().toISOString() } }, "raw").catch(() => undefined);
}

export type AiStatus = { on: boolean; creditsLeft: number; reason?: "disabled" | "cap" | "quota" | "error"; mock: boolean };

let cache: { at: number; value: AiStatus } | null = null;

export async function aiStatus(port: CloudPort, cfg: Config, { fresh = false } = {}): Promise<AiStatus> {
  if (cfg.genMode === "mock") return { on: true, creditsLeft: BUDGET.prodPool, mock: true };
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.value;
  let value: AiStatus;
  try {
    if (!cfg.liveAi) value = { on: false, creditsLeft: 0, reason: "disabled", mock: false };
    else {
      const left = BUDGET.prodPool - (await slotsUsed(port, POOLS.prod));
      const quota = await readQuota(port);
      if (left <= 0) value = { on: false, creditsLeft: 0, reason: "cap", mock: false };
      else if (quota !== undefined && quota <= BUDGET.quotaFloor) value = { on: false, creditsLeft: 0, reason: "quota", mock: false };
      else value = { on: true, creditsLeft: left, mock: false };
    }
  } catch {
    value = { on: false, creditsLeft: 0, reason: "error", mock: false };
  }
  cache = { at: Date.now(), value };
  return value;
}

export function resetBudgetCache() {
  cache = null;
  usageCache = null;
}

export type Reserve = { ok: true } | { ok: false; code: "BUDGET_PAUSED"; reason: string };

export async function reserveGeneration(port: CloudPort, cfg: Config, credits: number): Promise<Reserve> {
  if (cfg.genMode === "mock") return { ok: true };
  const s = await aiStatus(port, cfg, { fresh: true });
  if (!s.on) return { ok: false, code: "BUDGET_PAUSED", reason: s.reason ?? "paused" };
  if (s.creditsLeft < credits) return { ok: false, code: "BUDGET_PAUSED", reason: "cap" };
  try {
    const won = await claimSlots(port, POOLS.prod, credits);
    resetBudgetCache();
    return won ? { ok: true } : { ok: false, code: "BUDGET_PAUSED", reason: "cap" };
  } catch {
    return { ok: false, code: "BUDGET_PAUSED", reason: "error" };
  }
}

let usageCache: { at: number; used: number } | null = null;

async function planCreditsUsed(port: CloudPort): Promise<number> {
  if (usageCache && Date.now() - usageCache.at < 5 * 60_000) return usageCache.used;
  const u = await port.usage();
  usageCache = { at: Date.now(), used: u.creditsUsed };
  return u.creditsUsed;
}

export async function reserveUpload(port: CloudPort, cfg: Config): Promise<Reserve> {
  if (!cfg.liveUploads) return { ok: false, code: "BUDGET_PAUSED", reason: "uploads-off" };
  try {
    if ((await planCreditsUsed(port)) >= PLAN_CREDIT_STOP) return { ok: false, code: "BUDGET_PAUSED", reason: "plan" };
    return (await claimSlots(port, POOLS.sign, 1)) ? { ok: true } : { ok: false, code: "BUDGET_PAUSED", reason: "cap" };
  } catch {
    return { ok: false, code: "BUDGET_PAUSED", reason: "error" };
  }
}

export async function reserveCutout(port: CloudPort): Promise<Reserve> {
  try {
    return (await claimSlots(port, POOLS.cutout, 1)) ? { ok: true } : { ok: false, code: "BUDGET_PAUSED", reason: "cap" };
  } catch {
    return { ok: false, code: "BUDGET_PAUSED", reason: "error" };
  }
}
