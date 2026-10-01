import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bg, Chip, H, Kicker, P, Pop, Slam } from "./ui";
import { C, display, mono, s } from "./theme";

const SIZES = [
  { name: "Amazon main", dim: "2000×2000 · pure white", w: 230, h: 230, x: -560, y: -170 },
  { name: "Instagram", dim: "1080×1350", w: 200, h: 250, x: 520, y: -200 },
  { name: "Story / Reel", dim: "1080×1920", w: 160, h: 284, x: -500, y: 210 },
  { name: "WhatsApp / Meesho", dim: "1080×1080", w: 220, h: 220, x: 540, y: 220 },
];

/** 0–6 s: one real photo, four marketplace sizes it does not fit. */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const photo = spring({ frame, fps, config: { damping: 14 } });
  const dim = interpolate(frame, [s(3.6), s(3.9)], [1, 0.22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Bg />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: dim }}>
        <div style={{ position: "relative", transform: `scale(${interpolate(photo, [0, 1], [0.7, 1])})`, opacity: photo }}>
          <Img src={staticFile("stills/before.jpg")} style={{ width: 360, height: 360, objectFit: "cover", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }} />
          <div style={{ position: "absolute", bottom: -48, left: 0, right: 0, textAlign: "center", fontFamily: mono, fontSize: 18, color: C.muted }}>the real photo used in this demo</div>
        </div>
        {SIZES.map((z, i) => {
          const p = spring({ frame: frame - s(0.7 + i * 0.35), fps, config: { damping: 12 } });
          return (
            <div key={z.name} style={{ position: "absolute", left: 960 + z.x * p - z.w / 2, top: 540 + z.y * p - z.h / 2, opacity: p }}>
              <div style={{ width: z.w, height: z.h, borderRadius: 14, border: `3px dashed ${C.accent}`, display: "grid", placeItems: "center", fontFamily: display, fontWeight: 800, fontSize: 30, color: C.accent }}>?</div>
              <div style={{ marginTop: 10, fontFamily: display, fontWeight: 700, fontSize: 24, color: C.text, textAlign: "center" }}>{z.name}</div>
              <div style={{ fontFamily: mono, fontSize: 17, color: C.muted, textAlign: "center" }}>{z.dim}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 10 }}>
        <Slam at={3.7} size={150}>1 photo.</Slam>
        <Slam at={4.3} size={150} color={C.accent}>4 marketplaces.</Slam>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 6–10.5 s: logo. */
export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dot = spring({ frame, fps, config: { damping: 9, stiffness: 120 } });
  const grow = spring({ frame: frame - 14, fps, config: { damping: 14 } });
  const size = interpolate(dot, [0, 1], [900, 46]);
  const word = ["Real", "Stage"];
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Bg />
      <div style={{ position: "absolute", width: size, height: size, borderRadius: 28, background: C.accent, opacity: interpolate(grow, [0, 1], [1, 0]) }} />
      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        <div style={{ width: 74 * grow, height: 74 * grow, borderRadius: 18, background: C.accent }} />
        <div style={{ display: "flex" }}>
          {word.join("").split("").map((ch, i) => {
            const p = spring({ frame: frame - 16 - i * 2, fps, config: { damping: 12 } });
            return (
              <span
                key={i}
                style={{
                  fontFamily: display,
                  fontWeight: 800,
                  fontSize: 200,
                  letterSpacing: "-0.04em",
                  color: i >= 4 ? C.accent : C.text,
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [80, 0])}px)`,
                  display: "inline-block",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", top: 700 }}>
        <Pop at={1.4}>
          <P size={40} style={{ color: C.text, textAlign: "center" }}>
            Your <b style={{ color: C.accent }}>real</b> product. AI builds only the stage.
          </P>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

/** 10.5–18.5 s: AI tools redraw products; RealStage never touches them. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const lock = spring({ frame: frame - s(4.4), fps: 30, config: { damping: 12 } });
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", left: 130, top: 150, width: 760 }}>
        <Kicker color={C.muted}>Generic AI photo tools</Kicker>
        <H size={64} style={{ marginTop: 14 }}>
          Redraw the <span style={{ color: C.red }}>product.</span>
        </H>
        <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
          <Pop at={0.6} from="left"><Chip><span style={{ color: C.red }}>✗</span> Label text changes</Chip></Pop>
          <Pop at={1.0} from="left"><Chip><span style={{ color: C.red }}>✗</span> Colour and shape drift</Chip></Pop>
          <Pop at={1.4} from="left"><Chip><span style={{ color: C.red }}>✗</span> Buyer gets something else → refund</Chip></Pop>
        </div>
        <Pop at={2.3}>
          <div style={{ marginTop: 44, padding: "22px 26px", borderRadius: 18, border: `2px solid ${C.red}`, background: "rgba(255,92,97,0.08)" }}>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: C.text }}>Zomato banned AI-generated food photos.</div>
            <div style={{ fontFamily: mono, fontSize: 18, color: C.muted, marginTop: 8 }}>source: Inc42, Aug 2024 · complaints, refunds, bad ratings</div>
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: 1040, top: 150, width: 760 }}>
        <Kicker>RealStage</Kicker>
        <H size={64} style={{ marginTop: 14 }}>
          AI touches only the <span style={{ color: C.accent }}>scene.</span>
        </H>
        <div style={{ position: "relative", marginTop: 50, width: 420, height: 420, opacity: Math.min(1, lock * 1.4), transform: `scale(${interpolate(lock, [0, 1], [0.8, 1])})` }}>
          <Img src={staticFile("stills/amazon.png")} style={{ width: 420, height: 420, objectFit: "cover", borderRadius: 22, border: `3px solid ${C.accent}` }} />
          <div style={{ position: "absolute", right: -30, bottom: -24, fontFamily: display, fontWeight: 800, fontSize: 30, color: C.bg, background: C.accent, padding: "14px 22px", borderRadius: 16 }}>
            🔒 your pixels, untouched
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
