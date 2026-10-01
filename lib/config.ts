// Server-side configuration. Never import from client components.

export type Config = {
  cloud: string;
  apiKey: string;
  apiSecret: string;
  genMode: "mock" | "live";
  liveAi: boolean;
  liveUploads: boolean;
  sessionSecret: string;
  cronSecret: string;
};

const flag = (v: string | undefined) => (v ?? "").trim().toLowerCase();

export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const url = env.CLOUDINARY_URL ?? "";
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const cloud = m?.[3] ?? env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = m?.[1] ?? env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = m?.[2] ?? env.CLOUDINARY_API_SECRET ?? "";
  if (!cloud || !apiKey || !apiSecret) throw new Error("Cloudinary credentials missing (CLOUDINARY_URL)");
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET missing or shorter than 32 characters");
  return {
    cloud,
    apiKey,
    apiSecret,
    // Dashboard-pasted values can carry stray spaces or capitals; anything other than "live" still means mock.
    genMode: flag(env.GEN_MODE) === "live" ? "live" : "mock",
    liveAi: flag(env.LIVE_AI) === "on",
    liveUploads: flag(env.LIVE_UPLOADS) !== "off",
    sessionSecret: env.SESSION_SECRET || "",
    cronSecret: env.CRON_SECRET || "",
  };
}
