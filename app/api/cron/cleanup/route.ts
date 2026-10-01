import { NextResponse } from "next/server";
import { cloud } from "@/lib/cloud";
import { getConfig } from "@/lib/config";
import { log } from "@/lib/log";
import { deleteExpired } from "@/lib/services/cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily Vercel Hobby cron (vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET` (X7).
export async function GET(req: Request) {
  const cfg = getConfig();
  if (!cfg.cronSecret || req.headers.get("authorization") !== `Bearer ${cfg.cronSecret}`) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 401 });
  }
  const result = await deleteExpired(cloud());
  log("cron-cleanup", { outcome: "ok", ...result });
  return NextResponse.json({ ok: true, ...result });
}
