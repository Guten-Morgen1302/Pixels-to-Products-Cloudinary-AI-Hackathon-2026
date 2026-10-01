import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cloud, type CloudPort } from "./cloud";
import { getConfig, type Config } from "./config";
import { log } from "./log";
import { newSessionId, SESSION_COOKIE, signSession, verifySession } from "./session";
import { AppError, MESSAGES } from "./services/errors";

export type Ctx = { sid: string; cfg: Config; port: CloudPort };

// Shared route wrapper: server-issued session cookie, { ok, ... } envelope, coded errors, one log line per request.
export async function handle(route: string, fn: (ctx: Ctx) => Promise<Record<string, unknown>>): Promise<Response> {
  const started = Date.now();
  let cfg: Config;
  try {
    cfg = getConfig();
  } catch {
    log(route, { outcome: "error", code: "INTERNAL", why: "config" });
    return NextResponse.json({ ok: false, code: "INTERNAL", message: MESSAGES.INTERNAL }, { status: 500 });
  }
  const jar = await cookies();
  const existing = verifySession(jar.get(SESSION_COOKIE)?.value, cfg.sessionSecret);
  const sid = existing ?? newSessionId();
  let res: NextResponse;
  try {
    const data = await fn({ sid, cfg, port: cloud() });
    res = NextResponse.json({ ok: true, ...data });
    log(route, { outcome: "ok", ms: Date.now() - started, sid: sid.slice(0, 6) });
  } catch (e) {
    const err = e instanceof AppError ? e : new AppError("INTERNAL", MESSAGES.INTERNAL, 500);
    if (!(e instanceof AppError)) console.error(route, e);
    res = NextResponse.json({ ok: false, code: err.code, message: err.message }, { status: err.status });
    log(route, { outcome: "error", code: err.code, ms: Date.now() - started, sid: sid.slice(0, 6) });
  }
  if (!existing) {
    res.cookies.set(SESSION_COOKIE, signSession(sid, cfg.sessionSecret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 86_400,
      path: "/",
    });
  }
  return res;
}

export async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
  }
}
