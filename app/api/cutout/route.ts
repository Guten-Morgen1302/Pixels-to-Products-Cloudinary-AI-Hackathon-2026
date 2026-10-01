import { body, handle } from "@/lib/http";
import { makeCutout } from "@/lib/services/cutout";
import { AppError, MESSAGES } from "@/lib/services/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handle("cutout", async ({ sid, visitor, port }) => {
    const { publicId } = await body<{ publicId?: string }>(req);
    if (!publicId || typeof publicId !== "string") throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
    return { result: await makeCutout(port, sid, publicId, visitor) };
  });
}
