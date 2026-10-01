// Opaque server-issued session in an HMAC-signed httpOnly cookie (Outside Voice X6). The browser never chooses it.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "rs_sid";

function mac(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url").slice(0, 24);
}

export function newSessionId(): string {
  return randomBytes(12).toString("hex");
}

export function signSession(id: string, secret: string): string {
  if (!secret) throw new Error("SESSION_SECRET missing");
  return `${id}.${mac(id, secret)}`;
}

export function verifySession(cookie: string | undefined, secret: string): string | null {
  if (!cookie || !secret) return null;
  const [id, sig] = cookie.split(".");
  if (!id || !sig || !/^[a-f0-9]{24}$/.test(id)) return null;
  const expected = Buffer.from(mac(id, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

export const sessionFolder = (id: string) => `realstage/u/${id}`;
export const SAMPLE_FOLDER = "realstage/samples";

// Assets a session may operate on: its own folder or the shared samples.
export function ownsAsset(sessionId: string, publicId: string): boolean {
  return publicId.startsWith(`${sessionFolder(sessionId)}/`) || publicId.startsWith(`${SAMPLE_FOLDER}/`);
}

export function expTag(days = 7, now = new Date()): string {
  const d = new Date(now.getTime() + days * 86_400_000);
  return `exp-${d.toISOString().slice(0, 10).replace(/-/g, "")}`;
}
