import { body, handle } from "@/lib/http";
import { AppError, MESSAGES } from "@/lib/services/errors";
import { pollRelight, pollStage, startRelight, startStages, type RelightInput } from "@/lib/services/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

type Req =
  | { action: "stages"; prompt: string }
  | { action: "poll-stage"; taskId: string; prompt: string }
  | { action: "relight"; input: RelightInput }
  | { action: "poll-relight"; taskId: string; compositeId: string; input: RelightInput };

export async function POST(req: Request) {
  return handle("generate", async ({ sid, visitor, cfg, port }) => {
    const b = await body<Req>(req);
    switch (b?.action) {
      case "stages":
        return await startStages(port, cfg, b.prompt, visitor);
      case "poll-stage":
        return await pollStage(port, cfg, sid, String(b.taskId ?? ""), String(b.prompt ?? ""));
      case "relight":
        return await startRelight(port, cfg, sid, b.input, visitor);
      case "poll-relight":
        return await pollRelight(port, cfg, sid, String(b.taskId ?? ""), String(b.compositeId ?? ""), b.input);
      default:
        throw new AppError("BAD_REQUEST", MESSAGES.BAD_REQUEST);
    }
  });
}
