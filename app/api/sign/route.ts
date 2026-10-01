import { handle } from "@/lib/http";
import { signUpload } from "@/lib/services/cutout";

export const runtime = "nodejs";

export async function POST() {
  return handle("sign", async ({ sid, cfg, port }) => ({ upload: await signUpload(port, cfg, sid) }));
}
