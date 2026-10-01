import type { CloudPort } from "../cloud";

// Deletes every asset whose exp-YYYYMMDD tag is in the past (last 30 days scanned), with CDN invalidation (X7, R3-2).
export async function deleteExpired(port: CloudPort, now = new Date()): Promise<{ tags: string[]; deleted: number }> {
  const tags: string[] = [];
  let deleted = 0;
  for (let d = 1; d <= 30; d++) {
    const day = new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
    const tag = `exp-${day}`;
    const n = await port.deleteByTag(tag, "image");
    if (n > 0) tags.push(tag);
    deleted += n;
  }
  return { tags, deleted };
}
