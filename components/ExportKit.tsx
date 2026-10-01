"use client";
import type { KitFile } from "@/lib/urls";

export type KitState =
  | { status: "idle" }
  | { status: "preparing"; done: number }
  | { status: "ready"; files: KitFile[]; amazonOk: boolean; downloaded: boolean }
  | { status: "error"; message: string };

type Preview = { key: KitFile["key"]; label: string; size: string; social: boolean; preview: string };

type Props = { previews: Preview[]; kit: KitState; onDownloadAll: () => void; mobileBar?: boolean };

const WHITE_FAILED = "Couldn't make a clean white Amazon image. Try a photo with more space around the product.";

// Export kit (DR5 export row, X4): 4 individual fl_attachment downloads + client-side "Download all".
export default function ExportKit({ previews, kit, onDownloadAll }: Props) {
  const files = kit.status === "ready" ? kit.files : null;
  const label =
    kit.status === "preparing" ? `Preparing ${Math.min(kit.done, 4)}/4…` : kit.status === "ready" && kit.downloaded ? "Downloaded · Download again" : "Download all · 4 files";

  return (
    <section aria-label="Export kit">
      <h2>Export kit</h2>
      <ul className="kit">
        {previews.map((p) => {
          const f = files?.find((x) => x.key === p.key);
          const blocked = p.key === "amazon" && kit.status === "ready" && !kit.amazonOk;
          return (
            <li key={p.key}>
              <div className="well">
                <img src={f?.preview ?? p.preview} alt="" width={44} height={44} loading="lazy" />
              </div>
              <span>
                {p.label}
                {p.social && <span className="help" style={{ display: "block", margin: 0, fontSize: 13 }}>Social preview</span>}
              </span>
              <span className="meta mono">
                {p.size}
                <br />
                {f && !blocked ? <a href={f.download}>Download</a> : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="export-bar">
        <button className="btn primary" style={{ width: "100%" }} onClick={onDownloadAll} disabled={kit.status === "preparing"}>
          {label}
        </button>
      </div>
      <p className="help" aria-live="polite">
        {kit.status === "error"
          ? <span className="error">{kit.message}</span>
          : kit.status === "ready" && !kit.amazonOk
            ? <span className="error">{WHITE_FAILED}</span>
            : kit.status === "ready" && kit.downloaded
              ? "Files are named realstage-<product>-…"
              : "Amazon main stays pure white. Marketplace rule, no AI scene."}
      </p>
    </section>
  );
}
