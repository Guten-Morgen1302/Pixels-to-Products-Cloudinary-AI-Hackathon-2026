// One structured JSON line per route outcome, visible in Vercel logs (CEO-T6 / T-E10). Never log secrets or signatures.
export function log(route: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), route, ...fields }));
}
