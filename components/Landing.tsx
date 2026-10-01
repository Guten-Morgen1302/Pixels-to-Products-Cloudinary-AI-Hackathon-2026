"use client";
import { useRef, useState } from "react";

export type Sample = { publicId: string; name: string; cutW?: number; cutH?: number };

type Props = {
  cloud: string | null;
  samples: Sample[];
  uploadsOn: boolean;
  busy: { label: string; pct?: number } | null;
  error: string | null;
  beforeAfter: { before: string; after: string } | null;
  onFile: (f: File) => void;
  onSample: (s: Sample) => void;
};

const thumb = (cloud: string, id: string) => `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_88,h_88/f_auto,q_auto/${id}`;

// Landing state (DR1, DR2): one job, get a photo in. Samples for judges without a photo.
export default function Landing({ cloud, samples, uploadsOn, busy, error, beforeAfter, onFile, onSample }: Props) {
  const [over, setOver] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);

  return (
    <main className="land">
      <div>
        <h1>
          Your real product.
          <br />
          Studio stages.
          <br />
          Every marketplace size.
        </h1>
        <p className="sub">We never redraw your product. AI builds the scene around it.</p>

        <div
          className={`drop${over ? " over" : ""}${error ? " bad" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f && uploadsOn && !busy) onFile(f);
          }}
        >
          {busy ? (
            <>
              <p className="help" style={{ margin: 0 }} aria-live="polite">{busy.label}</p>
              {busy.pct !== undefined && (
                <div className="progress" role="progressbar" aria-valuenow={busy.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                  <i style={{ width: `${busy.pct}%` }} />
                </div>
              )}
            </>
          ) : uploadsOn ? (
            <>
              <label className="btn primary file">
                Upload a product photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) onFile(f);
                  }}
                />
              </label>
              <span className="help" style={{ margin: 0 }}>or drop it here · JPG, PNG, WebP, HEIC up to 10 MB</span>
            </>
          ) : (
            <p className="help" style={{ margin: 0 }}>Uploads paused for today. Try a sample.</p>
          )}
        </div>
        {error && (
          <p className="error" ref={errRef} role="alert" tabIndex={-1}>
            {error}
          </p>
        )}

        {samples.length > 0 && cloud && (
          <div className="samples">
            <span className="help" style={{ margin: 0 }}>No photo handy? Try a sample:</span>
            {samples.map((s) => (
              <button key={s.publicId} className="sample" onClick={() => onSample(s)} disabled={!!busy}>
                <img src={thumb(cloud, s.publicId)} alt="" width={44} height={44} />
                {s.name}
              </button>
            ))}
          </div>
        )}
        <p className="help">Demo: your photos are stored for 7 days, then deleted.</p>
      </div>

      <div className="ba" aria-label="Before and after example">
        <figure>
          <div className="well">{beforeAfter ? <img src={beforeAfter.before} alt="Sample product photographed on a plain surface" /> : "Phone photo"}</div>
          <figcaption>Before · phone photo</figcaption>
        </figure>
        <figure>
          <div className="well">{beforeAfter ? <img src={beforeAfter.after} alt="The same product placed on a generated stage" /> : "Same product, new stage"}</div>
          <figcaption>After · same pixels, new stage</figcaption>
        </figure>
      </div>
    </main>
  );
}
