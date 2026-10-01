"use client";
// RealStage studio. State machine:
//
//   landing ──photo/sample──► cutting ──ok──► studio ──"New photo"──► landing
//                               │ fail                │
//                               └──► landing + error   ├─ per stage: idle → relighting → relit | kept-exact | error
//                                                      ├─ fan-out:  idle → generating(3 cards) → done/partial
//                                                      └─ kit:      idle → preparing n/4 → ready → downloaded
//
// Stale results are dropped by comparing the product sequence number captured when a request started.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { api, ApiError, poll, sleep, uploadToCloudinary } from "./api";
import ExportKit, { type KitState } from "./ExportKit";
import Landing, { type Sample } from "./Landing";
import type { StageInfo } from "@/lib/services/stages";
import { comparePair, compositePreviewUrl, deliveryUrl, slugify, type CutRef, type KitFile } from "@/lib/urls";
import { BUDGET, DEFAULT_GEN_OPTION, EDIT_MODEL, GEN_OPTIONS } from "@/lib/models";

type Ai = { on: boolean; creditsLeft: number; reason?: string; mock: boolean };
type AppState = { cloud: string; stages: StageInfo[]; sessionStages: StageInfo[]; ai: Ai; samples: Sample[]; uploadsOn: boolean };
type Product = { name: string; originalId: string; cut: CutRef; coreId: string };
type Relight =
  | { status: "running"; started: number }
  | { status: "relit"; finalId: string; alignment: number }
  | { status: "kept"; finalId: string; alignment: number | null }
  | { status: "error"; message: string };
type GenCard = { model: string; status: "pending" | "done" | "error"; stage?: StageInfo; message?: string };

const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;
const OK_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const RELIGHT_EXPECTED_MS = 30_000;

export default function Studio() {
  const [app, setApp] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; pct?: number } | null>(null);
  const [landError, setLandError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [generated, setGenerated] = useState<StageInfo[]>([]);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [relights, setRelights] = useState<Record<string, Relight>>({});
  const [gen, setGen] = useState<{ prompt: string; cards: GenCard[] } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [genModel, setGenModel] = useState(DEFAULT_GEN_OPTION);
  const [genError, setGenError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [kit, setKit] = useState<KitState>({ status: "idle" });
  const [now, setNow] = useState(Date.now());
  const seq = useRef(0);
  const genBusy = useRef(false); // synchronous double-submit guard: set before the first await
  const kitSeq = useRef(0); // invalidates in-flight /api/kit results when the look changes
  const [genStarting, setGenStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api<AppState & { ok: true }>("/api/state");
      setApp(s);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Couldn't load RealStage. Refresh the page.");
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  // ---------- stages shown ----------
  const library = app?.stages ?? [];
  const pool = useMemo(() => [...generated, ...(app?.sessionStages ?? []).filter((s) => !generated.some((g) => g.publicId === s.publicId)), ...library], [generated, app, library]);
  const strip = useMemo(() => {
    if (generated.length) return generated.slice(0, 3);
    const start = (page * 3) % Math.max(library.length, 1);
    return library.length <= 3 ? library : [...library, ...library].slice(start, start + 3);
  }, [generated, library, page]);
  const selected = pool.find((s) => s.publicId === selectedId) ?? strip[0] ?? null;
  const relight = selected ? relights[selected.publicId] : undefined;
  const relitFinal = relight?.status === "relit" ? relight.finalId : undefined;

  useEffect(() => {
    kitSeq.current++;
    setKit({ status: "idle" });
    setCompare(false);
  }, [selected?.publicId, relitFinal, product?.cut.publicId]);

  // progress line while relighting
  useEffect(() => {
    if (relight?.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [relight?.status]);

  // ---------- upload / sample → cutout ----------
  async function cutout(originalId: string, name: string, mySeq: number) {
    setBusy({ label: "Cutting out your product…" });
    const end = Date.now() + 45_000;
    for (;;) {
      try {
        const r = await api<{ result: { cut: CutRef; coreId: string } }>("/api/cutout", { publicId: originalId });
        if (mySeq !== seq.current) return;
        setProduct({ name, originalId, cut: r.result.cut, coreId: r.result.coreId });
        setRelights({});
        setBusy(null);
        return;
      } catch (e) {
        if (e instanceof ApiError && e.code === "PROCESSING" && Date.now() < end) {
          setBusy({ label: "Taking longer than usual…" });
          await sleep(3000);
          continue;
        }
        throw e;
      }
    }
  }

  async function onFile(file: File) {
    setLandError(null);
    if (!OK_TYPES.test(file.type) && !OK_EXT.test(file.name)) return setLandError("That file isn't a photo.");
    if (file.size > MAX_BYTES) return setLandError("Photos up to 10 MB, please.");
    const mySeq = ++seq.current;
    try {
      setBusy({ label: "Uploading 0%", pct: 0 });
      const { upload } = await api<{ upload: Record<string, string | number> }>("/api/sign", {});
      const res = await uploadToCloudinary(file, upload, (pct) => setBusy({ label: `Uploading ${pct}%`, pct }));
      await cutout(res.public_id, file.name, mySeq);
    } catch (e) {
      if (mySeq !== seq.current) return;
      setBusy(null);
      setLandError(e instanceof ApiError ? e.message : "Upload failed. Try again.");
    }
  }

  async function onSample(s: Sample) {
    setLandError(null);
    const mySeq = ++seq.current;
    try {
      await cutout(s.publicId, s.name, mySeq);
    } catch (e) {
      if (mySeq !== seq.current) return;
      setBusy(null);
      setLandError(e instanceof ApiError ? e.message : "Something went wrong on our side. Try again.");
    }
  }

  function newPhoto() {
    seq.current++;
    setProduct(null);
    setGenerated([]);
    setGen(null);
    setRelights({});
    setSelectedId(null);
    setBusy(null);
    setLandError(null);
    void refresh();
  }

  // ---------- relight (phase 2: Pixel-Lock) ----------
  async function onRelight() {
    if (!app || !product || !selected) return;
    const stageId = selected.publicId;
    const mySeq = seq.current;
    const input = { stage: { publicId: selected.publicId, w: selected.w, h: selected.h, geometry: selected.geometry }, cut: product.cut, coreId: product.coreId };
    setRelights((r) => ({ ...r, [stageId]: { status: "running", started: Date.now() } }));
    try {
      const start = await api<{ compositeId: string; taskId: string }>("/api/generate", { action: "relight", input });
      const out = await poll(
        async () => {
          const r = await api<{ status: string; finalId?: string; alignment?: number | null; fallback?: boolean }>("/api/generate", { action: "poll-relight", taskId: start.taskId, compositeId: start.compositeId, input });
          return r.status === "done" ? r : null;
        },
        { cancelled: () => mySeq !== seq.current },
      );
      if (mySeq !== seq.current) return;
      setRelights((r) => ({
        ...r,
        [stageId]: out.fallback ? { status: "kept", finalId: out.finalId!, alignment: out.alignment ?? null } : { status: "relit", finalId: out.finalId!, alignment: out.alignment ?? 0 },
      }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "CANCELLED") return;
      setRelights((r) => ({ ...r, [stageId]: { status: "error", message: e instanceof ApiError ? e.message : "This model didn't respond." } }));
    } finally {
      void refresh();
    }
  }

  // ---------- 3-model fan-out (Track 2 proof) ----------
  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (genBusy.current) return;
    genBusy.current = true;
    setGenStarting(true);
    setGenError(null);
    const mySeq = seq.current;
    try {
      const start = await api<{ prompt: string; tasks: { model: string; taskId: string; error?: string }[] }>("/api/generate", { action: "stages", prompt, model: genModel });
      const cards: GenCard[] = start.tasks.map((t) => ({ model: t.model, status: t.error ? "error" : "pending", message: t.error ? "This model didn't respond." : undefined }));
      if (mySeq !== seq.current) return;
      setGen({ prompt: start.prompt, cards });
      setGenStarting(false);
      await Promise.all(
        start.tasks.map(async (t, i) => {
          if (t.error) return;
          try {
            const r = await poll(async () => {
              const p = await api<{ status: string; stage?: StageInfo }>("/api/generate", { action: "poll-stage", taskId: t.taskId, prompt: start.prompt });
              return p.status === "done" ? p.stage! : null;
            }, { cancelled: () => mySeq !== seq.current });
            if (mySeq !== seq.current) return;
            setGen((g) => (g ? { ...g, cards: g.cards.map((c, j) => (j === i ? { ...c, status: "done", stage: r } : c)) } : g));
            setGenerated((list) => {
              const next = [r, ...list.filter((s) => s.publicId !== r.publicId)];
              return next;
            });
            if (i === 0) setSelectedId(r.publicId);
          } catch (err) {
            if (err instanceof ApiError && err.code === "CANCELLED") return;
            setGen((g) => (g ? { ...g, cards: g.cards.map((c, j) => (j === i ? { ...c, status: "error", message: err instanceof ApiError ? err.message : "This model didn't respond." } : c)) } : g));
          }
        }),
      );
    } catch (err) {
      if (mySeq === seq.current) setGenError(err instanceof ApiError ? err.message : "Something went wrong on our side. Try again.");
    } finally {
      genBusy.current = false;
      setGenStarting(false);
      void refresh();
    }
  }

  // ---------- kit ----------
  async function onDownloadAll() {
    if (!app || !product || !selected) return;
    const myKit = ++kitSeq.current;
    const live = () => myKit === kitSeq.current;
    setKit({ status: "preparing", done: 0 });
    try {
      const r = await api<{ kit: { files: KitFile[]; amazonOk: boolean } }>("/api/kit", {
        stage: { publicId: selected.publicId, w: selected.w, h: selected.h, geometry: selected.geometry, name: selected.name, model: selected.model },
        cut: product.cut,
        relitFinalId: relitFinal,
        productName: product.name,
        alignment: relight?.status === "relit" ? relight.alignment : null,
      });
      const files = r.kit.files.filter((f) => f.key !== "amazon" || r.kit.amazonOk);
      const zip = new JSZip();
      let done = 0;
      try {
        await Promise.all(
          files.map(async (f) => {
            const res = await fetch(f.download);
            if (!res.ok) throw new Error(String(res.status));
            const name = /fl_attachment:([^/]+)/.exec(f.download)?.[1] ?? f.key;
            zip.file(`${name}.jpg`, await res.blob());
            if (live()) setKit({ status: "preparing", done: ++done });
          }),
        );
        const blob = await zip.generateAsync({ type: "blob" });
        if (!live()) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `realstage-${slugify(product.name)}-kit.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        setKit({ status: "ready", files: r.kit.files, amazonOk: r.kit.amazonOk, downloaded: true });
      } catch {
        // Zip failed (network/CORS): the 4 individual links still work.
        if (live()) setKit({ status: "ready", files: r.kit.files, amazonOk: r.kit.amazonOk, downloaded: false });
      }
    } catch (e) {
      if (live()) setKit({ status: "error", message: e instanceof ApiError ? e.message : "Something went wrong on our side. Try again." });
    }
  }

  // ---------- render ----------
  const ai = app?.ai;
  const badge = ai?.mock ? "Demo AI (simulated, 0 credits)" : ai?.on ? `AI credits left: ${ai.creditsLeft} of ${BUDGET.prodPool}` : null;
  const header = (
    <header className="top">
      <a className="mark" href="/" onClick={(e) => { if (product) { e.preventDefault(); newPhoto(); } }}>
        Real<span>Stage</span>
      </a>
      {badge && (
        <span className="mono" aria-live="polite">
          <span className="badge-long">{badge}</span>
          <span className="badge-short">{ai?.mock ? "AI demo" : `AI ${ai?.creditsLeft}/${BUDGET.prodPool}`}</span>
        </span>
      )}
    </header>
  );

  if (!product || !app) {
    const s0 = app?.samples[0];
    const l0 = app?.stages[0];
    // Real before/after (D7): a real sample photo and the same pixels on a real library stage.
    const beforeAfter =
      app && s0 && l0 && s0.cutW && s0.cutH
        ? {
            before: deliveryUrl(app.cloud, s0.publicId, ["c_fill,w_600,h_750", "f_auto,q_auto"]),
            after: compositePreviewUrl(app.cloud, l0, { publicId: `${s0.publicId}_cut`, w: s0.cutW, h: s0.cutH }, 600),
          }
        : null;
    return (
      <>
        {header}
        {loadError ? (
          <main className="land"><p className="error" role="alert">{loadError}</p></main>
        ) : (
          <Landing cloud={app?.cloud ?? null} samples={app?.samples ?? []} uploadsOn={app?.uploadsOn ?? true} busy={busy} error={landError} beforeAfter={beforeAfter} onFile={onFile} onSample={onSample} />
        )}
      </>
    );
  }

  const cloud = app.cloud;
  const heroSrc = selected ? (relitFinal ? deliveryUrl(cloud, relitFinal, ["c_scale,w_1024", "f_auto,q_auto"]) : compositePreviewUrl(cloud, selected, product.cut)) : null;
  const aiOn = !!ai?.on;
  const genOpt = GEN_OPTIONS.find((o) => o.modelId === genModel) ?? GEN_OPTIONS[0];
  const canFanOut = aiOn && (ai?.mock || (ai?.creditsLeft ?? 0) >= genOpt.credits);
  const genWhat = (o: { count: number }) => (o.count > 1 ? o.count + " variations" : "1 image");
  const pausedMsg = "Live AI paused to save credits. Library stages still work.";
  const generating = genStarting || !!gen?.cards.some((c) => c.status === "pending");
  // One list drives both rendering and keyboard navigation (cards while generating, otherwise the strip).
  const rendered: GenCard[] = gen?.cards.some((c) => c.status === "pending")
    ? gen.cards
    : strip.map((s) => ({ model: s.model, status: "done" as const, stage: s }));
  const selectable = rendered.filter((c) => c.stage).map((c) => c.stage!);
  const anyChecked = selectable.some((s) => s.publicId === selected?.publicId);

  const previews = selected
    ? [
        { key: "amazon" as const, label: "Amazon main · white", size: "2000×2000", social: false, preview: deliveryUrl(cloud, product.cut.publicId, ["c_pad,w_1700,h_1700,b_white", "c_mpad,w_2000,h_2000,b_white", "c_scale,w_88", "f_auto,q_auto"]) },
        ...([["instagram", "Instagram post", "1080×1350"], ["story", "Story / Reel cover", "1080×1920"], ["whatsapp", "WhatsApp / Meesho", "1080×1080"]] as const).map(([key, label, size]) => ({
          key, label, size, social: selected.w < 2000,
          preview: relitFinal ? deliveryUrl(cloud, relitFinal, ["c_fill,w_88,h_88", "f_auto,q_auto"]) : compositePreviewUrl(cloud, selected, product.cut, 88),
        })),
      ]
    : [];

  const onKeyRadio = (e: React.KeyboardEvent) => {
    const i = selectable.findIndex((s) => s.publicId === selected?.publicId);
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d || !selectable.length) return;
    e.preventDefault();
    const next = selectable[(i + d + selectable.length) % selectable.length];
    setSelectedId(next.publicId);
    (document.getElementById(`opt-${next.publicId}`) as HTMLElement | null)?.focus();
  };

  const pair = selected ? comparePair(cloud, selected, product.cut, relitFinal) : null;

  return (
    <>
      {header}
      <div className="studio">
        <main>
          <div className="stage-wrap">
            <div className="well stage">
              {relight?.status === "running" && <span className="bar-top" style={{ width: `${Math.min(95, ((now - relight.started) / RELIGHT_EXPECTED_MS) * 100)}%` }} />}
              {heroSrc ? <img src={heroSrc} alt={selected ? `Your product on ${selected.name}, background generated by ${selected.model}` : ""} /> : "No stages yet"}
              {relight?.status === "relit" && <span className="chip">Alignment {relight.alignment.toFixed(2)} · real pixels locked</span>}
              {relight?.status === "kept" && (
                <span className="chip">
                  We kept your exact photo
                  <small>AI moved the product, so we didn&apos;t use its lighting.</small>
                </span>
              )}
              {relight?.status === "running" && <span className="status" aria-live="polite">Relighting… ~30 s</span>}
              {relight?.status === "error" && <span className="status error" role="alert">{relight.message}</span>}
            </div>
            <div className="tools">
              <button className="btn small" aria-pressed={compare} onClick={() => setCompare((c) => !c)} disabled={!selected}>
                Compare
              </button>
              <button
                className="btn small"
                onClick={onRelight}
                disabled={!selected || relight?.status === "running"}
                aria-disabled={!aiOn}
                title={aiOn ? undefined : pausedMsg}
              >
                {relight?.status === "running" ? "Relighting…" : `Relight with AI · uses ${EDIT_MODEL.credits}`}
              </button>
            </div>
          </div>
          {!aiOn && <p className="help">{pausedMsg}</p>}

          {compare && pair && (
            <section className="compare" aria-label="Compare your photo with the staged product">
              <h2>Compare</h2>
              <div className="pair">
                <figure><div className="well"><img src={pair.yours} alt="Your product, original photo pixels" /></div><figcaption>Your photo</figcaption></figure>
                <figure><div className="well"><img src={pair.staged} alt="The same region on the stage, same scale" /></div><figcaption>On stage · same crop, same scale</figcaption></figure>
              </div>
            </section>
          )}

          <div className="opts" role="radiogroup" aria-label="Choose a stage" onKeyDown={onKeyRadio}>
            {rendered.map((c, i) => {
              const s = c.stage;
              const checked = !!s && s.publicId === selected?.publicId;
              return (
                <div
                  key={s?.publicId ?? `${c.model}-${i}`}
                  id={s ? `opt-${s.publicId}` : undefined}
                  className="opt lands"
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={!s}
                  tabIndex={checked || (!anyChecked && s?.publicId === selectable[0]?.publicId) ? 0 : -1}
                  onClick={() => s && setSelectedId(s.publicId)}
                >
                  <div className="well">
                    {s ? <img src={compositePreviewUrl(cloud, s, product.cut, 320)} alt="" loading="lazy" /> : c.status === "pending" ? "Generating… ~30 s" : <span className="error" style={{ margin: 0 }}>{c.message}</span>}
                  </div>
                  <span className="name">{s?.name ?? c.model}</span>
                  <span className="mono">{(s?.model ?? c.model) + " · " + (s ? (s.seed === null ? "seed n/a" : `seed ${s.seed}`) : "")}</span>
                  <br />
                  {s && <span className="free">{s.library ? "Free to use" : "Generated just now"}</span>}
                </div>
              );
            })}
          </div>
          {!generated.length && library.length > 3 && (
            <button className="link" onClick={() => setPage((p) => p + 1)}>More stages</button>
          )}

          {/* Track 2: variations + model choice, with the real credit price of each model on screen. */}
          <form className="gen" onSubmit={onGenerate}>
            <label>
              Describe a new stage
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. brass thali table, festive evening" maxLength={200} />
            </label>
            <label className="model-pick">
              Model
              <select value={genModel} onChange={(e) => setGenModel(e.target.value)} disabled={generating}>
                {GEN_OPTIONS.map((o) => (
                  <option key={o.modelId} value={o.modelId}>
                    {o.label} · {genWhat(o)} · {o.credits} credit{o.credits > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit" disabled={generating || !canFanOut || prompt.trim().length < 3} title={canFanOut ? undefined : pausedMsg}>
              {generating ? "Generating…" : "Generate " + genWhat(genOpt) + " · uses " + genOpt.credits}
            </button>
          </form>
          {genError && <p className="error" role="alert">{genError}</p>}
        </main>

        <aside className="side" aria-label="Product and export">
          <div>
            <h2>Your product</h2>
            <div className="you">
              <div className="well"><img src={deliveryUrl(cloud, product.originalId, ["c_fill,w_112,h_112", "f_auto,q_auto"])} alt="Original photo" /></div>
              <div className="well"><img src={deliveryUrl(cloud, product.cut.publicId, ["c_pad,w_112,h_112,b_rgb:F5F6F8", "f_auto,q_auto"])} alt="Cutout" /></div>
              <div>
                <b style={{ fontSize: 14, display: "block", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</b>
                <button className="link" onClick={newPhoto}>New photo</button>
              </div>
            </div>
            <p className="help">Cutout looks wrong? <button className="link" onClick={newPhoto}>Retake</button></p>
          </div>
          <ExportKit previews={previews} kit={kit} onDownloadAll={onDownloadAll} />
        </aside>
      </div>
    </>
  );
}
