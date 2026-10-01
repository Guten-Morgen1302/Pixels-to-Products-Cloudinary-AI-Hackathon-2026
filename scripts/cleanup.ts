// Manual cleanup (same logic as the daily cron). `npm run cleanup` deletes every asset with a past exp- tag.
import "./env";
import { createCloud } from "../lib/cloud";
import { deleteExpired } from "../lib/services/cleanup";

deleteExpired(createCloud())
  .then((r) => console.log(`deleted ${r.deleted} assets (${r.tags.join(", ") || "no expired tags"})`))
  .catch((e) => {
    console.error("cleanup failed:", e?.error?.message ?? e?.message ?? e);
    process.exit(1);
  });
