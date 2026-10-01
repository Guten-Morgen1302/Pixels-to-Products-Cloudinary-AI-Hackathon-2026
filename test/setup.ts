// Guard: any real network call from a unit test is a bug, and a call to /v2/generate would spend credits.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (/^https?:\/\//.test(url)) {
    throw new Error(`Network call blocked in tests: ${url.replace(/\?.*$/, "")}`);
  }
  return realFetch(input, init);
}) as typeof fetch;

process.env.GEN_MODE = "mock";
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
process.env.CRON_SECRET = "test-cron-secret";
process.env.CLOUDINARY_URL = "cloudinary://111111111111111:testsecret@testcloud";
