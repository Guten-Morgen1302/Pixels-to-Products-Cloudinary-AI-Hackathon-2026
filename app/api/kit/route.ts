import { body, handle } from "@/lib/http";
import { makeKit, type KitInput } from "@/lib/services/kit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handle("kit", async ({ sid, port }) => ({ kit: await makeKit(port, sid, await body<KitInput>(req)) }));
}
