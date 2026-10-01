import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { Bg, Chip, Code, H, Kicker, P, Pop, Slam } from "./ui";
import { C, display, mono, s } from "./theme";

const PIPE = [
  { k: "Upload API", d: "signed, browser → Cloudinary" },
  { k: "e_background_removal", d: "cutout, paid once" },
  { k: "text_to_image", d: "3 model families" },
  { k: "layers l_ / fl_layer_apply", d: "product + shadow on stage" },
  { k: "image_to_image", d: "relight, ref [1]" },
  { k: "c_pad · c_mpad · fl_attachment", d: "4-file kit" },
];

/** Cloudinary is the whole backend. */
export const Pipeline: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", left: 130, top: 80, right: 130 }}>
        <Kicker>How it works</Kicker>
        <H size={66} style={{ marginTop: 12 }}>
          Cloudinary is the <span style={{ color: C.accent }}>entire backend.</span>
        </H>
        <Pop at={0.4}>
          <P size={28} style={{ marginTop: 10 }}>No database: tags, context and structured metadata hold every stage, session and kit.</P>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: 130, top: 330, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, width: 1660 }}>
        {PIPE.map((p, i) => {
          const a = spring({ frame: frame - s(0.9 + i * 0.45), fps: 30, config: { damping: 13 } });
          return (
            <div
              key={p.k}
              style={{
                opacity: a,
                transform: `translateY(${interpolate(a, [0, 1], [40, 0])}px)`,
                background: C.panel,
                border: `1.5px solid ${i === 2 || i === 4 ? C.accent : C.line}`,
                borderRadius: 20,
                padding: "22px 26px",
              }}
            >
              <div style={{ fontFamily: mono, fontSize: 18, color: C.muted }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 25, color: C.accent, marginTop: 6 }}>{p.k}</div>
              <div style={{ fontFamily: display, fontSize: 27, color: C.text, marginTop: 6 }}>{p.d}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 130, top: 760, width: 1060 }}>
        <Code
          at={4.4}
          step={0.55}
          size={21}
          lines={[
            { t: "# lib/budget.ts: atomic credit ledger, no DB", c: C.muted },
            { t: "upload('prod-07', overwrite: false)" },
            { t: "  → existing: true  ⇒ someone else won that credit", c: C.amber },
            { t: "  → created         ⇒ this request may spend it", c: C.accent },
          ]}
        />
      </div>
      <div style={{ position: "absolute", left: 1240, top: 790, width: 560, display: "flex", flexDirection: "column", gap: 14 }}>
        <Pop at={6.0}><Chip size={24}>Verified: 8 parallel claims → 1 winner</Chip></Pop>
        <Pop at={6.5}><Chip size={24}>Fails closed: any error pauses live AI</Chip></Pop>
      </div>
    </AbsoluteFill>
  );
};

const STATS = [
  { n: 68, label: "automated tests", pre: "", suf: "" },
  { n: 3, label: "AI model families, side by side", pre: "", suf: "" },
  { n: 4, label: "marketplace files per click", pre: "", suf: "" },
  { n: 15, label: "credit hard cap for public live AI", pre: "", suf: "" },
  { n: 0, label: "database. Cloudinary holds it all", pre: "", suf: "" },
  { n: 0, label: "spent: Cloudinary free tier", pre: "₹", suf: "" },
];

export const Stats: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", left: 150, top: 90 }}>
        <Kicker>Engineering, not a mock-up</Kicker>
        <H size={64} style={{ marginTop: 12 }}>Built to survive real users.</H>
      </div>
      <div style={{ position: "absolute", left: 150, top: 290, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 90, rowGap: 34, width: 1620 }}>
        {STATS.map((st, i) => {
          const p = spring({ frame: frame - s(0.5 + i * 0.45), fps: 30, config: { damping: 12 } });
          const val = Math.round(interpolate(p, [0, 1], [0, st.n]));
          return (
            <div key={st.label} style={{ display: "flex", alignItems: "baseline", gap: 26, opacity: Math.min(1, p * 1.5) }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 104, color: i === 5 ? C.accent : C.text, minWidth: 230, letterSpacing: "-0.04em" }}>
                {st.pre}
                {val}
                {st.suf}
              </div>
              <div style={{ fontFamily: display, fontSize: 31, color: C.muted, maxWidth: 480 }}>{st.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [s(6.6), s(8)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Bg />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 18 }}>
        <Slam at={0.2} size={128}>Your real product.</Slam>
        <Slam at={0.8} size={128} color={C.accent}>Every marketplace.</Slam>
        <Pop at={1.9}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 40 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.accent }} />
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: C.text }}>
              Real<span style={{ color: C.accent }}>Stage</span>
            </div>
          </div>
        </Pop>
        <Pop at={2.4}>
          <P size={30} style={{ color: C.text, textAlign: "center" }}>Pixels to Products · Cloudinary AI Hackathon 2026 · Track 2</P>
        </Pop>
        <Pop at={2.9}>
          <div style={{ fontFamily: mono, fontSize: 28, color: C.accentSoft, marginTop: 8 }}>github.com/Guten-Morgen1302/Pixels-to-Products-Cloudinary-AI-Hackathon-2026</div>
        </Pop>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
