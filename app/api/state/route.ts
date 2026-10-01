import { aiStatus } from "@/lib/budget";
import { handle } from "@/lib/http";
import { libraryStages, sessionStages } from "@/lib/services/stages";
import type { CloudPort } from "@/lib/cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let sampleCache: { at: number; samples: Sample[] } | null = null;
type Sample = { publicId: string; name: string; cutW?: number; cutH?: number };

async function samples(port: CloudPort): Promise<Sample[]> {
  if (sampleCache && Date.now() - sampleCache.at < 300_000) return sampleCache.samples;
  try {
    const list = (await port.listTag("sample"))
      .filter((a) => !/_(cut|core)$/.test(a.publicId))
      .map((a) => ({ publicId: a.publicId, name: a.context?.rs_name ?? "Sample", cutW: Number(a.context?.rs_cut_w) || undefined, cutH: Number(a.context?.rs_cut_h) || undefined }))
      .sort((a, b) => a.publicId.localeCompare(b.publicId));
    sampleCache = { at: Date.now(), samples: list };
    return list;
  } catch {
    return [];
  }
}

export async function GET() {
  return handle("state", async ({ sid, cfg, port }) => {
    const [lib, mine, ai, sampleList] = await Promise.all([libraryStages(port), sessionStages(port, sid), aiStatus(port, cfg), samples(port)]);
    return { cloud: port.cloud, stages: lib.stages, stageSource: lib.source, sessionStages: mine, ai, samples: sampleList, uploadsOn: cfg.liveUploads };
  });
}
