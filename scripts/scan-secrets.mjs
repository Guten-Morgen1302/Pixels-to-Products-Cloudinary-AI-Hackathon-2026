// Fails if any real secret value from .env / .env.local appears in staged changes or in tracked files.
// Prints only which variable leaked, never the value. Run before every push: node scripts/scan-secrets.mjs
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const SECRET_KEYS = ["CLOUDINARY_URL", "CLOUDINARY_API_SECRET", "CLOUDINARY_API_KEY", "SESSION_SECRET", "CRON_SECRET"];
const values = new Map();
for (const f of [".env", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m || !SECRET_KEYS.includes(m[1])) continue;
    values.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    const url = m[2].match(/^cloudinary:\/\/([^:]+):([^@]+)@/);
    if (url) { values.set("CLOUDINARY_URL api_key", url[1]); values.set("CLOUDINARY_URL api_secret", url[2]); }
  }
}

const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const staged = sh("git diff --cached");
const tracked = sh("git ls-files -z").split("\0").filter(Boolean)
  .filter((f) => !/\.(png|jpg|jpeg|webp|ico|woff2?)$/i.test(f) && existsSync(f))
  .map((f) => readFileSync(f, "utf8")).join("\n");

const leaks = [];
for (const [name, v] of values) {
  if (!v || v.length < 6) continue;
  if (staged.includes(v)) leaks.push(`${name} (staged)`);
  if (tracked.includes(v)) leaks.push(`${name} (tracked file)`);
}
if (leaks.length) { console.error("SECRET LEAK:", leaks.join(", ")); process.exit(1); }
console.log(`secret scan clean (${values.size} values checked against staged diff and tracked files)`);
