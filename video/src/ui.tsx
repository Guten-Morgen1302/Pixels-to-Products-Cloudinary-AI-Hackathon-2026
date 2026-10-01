import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, display, emoji, mono, s } from "./theme";

/** Spring-in from `at` seconds (relative to the current Sequence). */
export const useIn = (at: number, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - s(at), fps, config: { damping, stiffness: 140, mass: 0.7 } });
};

export const Pop: React.FC<{ at: number; children: React.ReactNode; from?: "up" | "left" | "scale"; style?: React.CSSProperties }> = ({ at, children, from = "up", style }) => {
  const p = useIn(at);
  const t =
    from === "left"
      ? `translateX(${interpolate(p, [0, 1], [-60, 0])}px)`
      : from === "scale"
        ? `scale(${interpolate(p, [0, 1], [0.6, 1])})`
        : `translateY(${interpolate(p, [0, 1], [40, 0])}px)`;
  return <div style={{ opacity: Math.min(1, p * 1.4), transform: t, ...style }}>{children}</div>;
};

/** Slams in big then settles: for the punchy lines. */
export const Slam: React.FC<{ at: number; children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ at, children, size = 120, color = C.text, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - s(at), fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  return (
    <div
      style={{
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: "-0.03em",
        color,
        opacity: p > 0.01 ? 1 : 0,
        transform: `scale(${interpolate(p, [0, 1], [2.4, 1])})`,
        filter: `blur(${interpolate(p, [0, 0.6, 1], [14, 2, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame % 600, [0, 600], [0, 360]);
  return <AbsoluteFill style={{ background: `linear-gradient(${135 + Math.sin((a * Math.PI) / 180) * 8}deg, ${C.bg} 0%, ${C.bg2} 55%, ${C.bg} 100%)` }} />;
};

export const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.accent }) => (
  <div style={{ fontFamily: mono, fontSize: 21, letterSpacing: "0.14em", textTransform: "uppercase", color, fontWeight: 700 }}>{children}</div>
);

export const H: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 64, style }) => (
  <div style={{ fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.025em", color: C.text, ...style }}>{children}</div>
);

export const P: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 30, style }) => (
  <div style={{ fontFamily: display, fontWeight: 400, fontSize: size, lineHeight: 1.3, color: C.muted, ...style }}>{children}</div>
);

export const E: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ fontFamily: emoji }}>{children}</span>;

export const Chip: React.FC<{ children: React.ReactNode; color?: string; bg?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = C.text, bg = C.panel, size = 26, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      padding: "13px 20px",
      borderRadius: 16,
      background: bg,
      border: `1.5px solid ${C.line}`,
      fontFamily: display,
      fontWeight: 600,
      fontSize: size,
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Code: React.FC<{ lines: { t: string; c?: string }[]; at: number; step?: number; size?: number }> = ({ lines, at, step = 0.35, size = 22 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: mono, fontSize: size, lineHeight: 1.55, background: "#0c1210", border: `1.5px solid ${C.line}`, borderRadius: 18, padding: "20px 24px", color: C.text, whiteSpace: "pre" }}>
      {lines.map((l, i) => {
        const start = s(at + i * step);
        const n = Math.max(0, Math.min(l.t.length, Math.floor((frame - start) * 2.4)));
        return (
          <div key={i} style={{ color: l.c ?? C.text, minHeight: size * 1.55 }}>
            {l.t.slice(0, n)}
            {n > 0 && n < l.t.length ? <span style={{ color: C.accent }}>▍</span> : null}
          </div>
        );
      })}
    </div>
  );
};

/* Footage box: the recording is the app area of a 1280×720 browser capture (chrome cropped), 1280×600. */
export const FX = 64;
export const FY = 196;
export const FW = 1170;
export const FH = Math.round((FW * 600) / 1280); // 548
const BAR = 46;

/** The real recording inside a clean browser frame (our own chrome; the user's tabs/bookmarks were cropped out). */
export const Browser: React.FC<{ src: string; url?: string }> = ({ src, url = "localhost:3000" }) => (
  <div style={{ width: FW, borderRadius: 18, overflow: "hidden", background: "#050706", boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1.5px #26302b" }}>
    <div style={{ height: BAR, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#111614" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
      ))}
      <div style={{ marginLeft: 18, flex: 1, height: 28, borderRadius: 8, background: "#0a0e0c", display: "flex", alignItems: "center", padding: "0 14px", fontFamily: mono, fontSize: 16, color: C.muted }}>
        {url}
      </div>
    </div>
    <OffthreadVideo src={staticFile(src)} muted style={{ width: FW, height: FH, display: "block" }} />
  </div>
);

/** Points at a spot in the footage (fx, fy are 0–1 of the 1280×600 app area). Label sits at (lx, ly) in canvas px. */
export const Callout: React.FC<{ at: number; until?: number; fx: number; fy: number; lx: number; ly: number; children: React.ReactNode }> = ({ at, until = 999, fx, fy, lx, ly, children }) => {
  const frame = useCurrentFrame();
  const p = useIn(at, 13);
  const out = interpolate(frame, [s(until), s(until) + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = FX + fx * FW;
  const y = FY + BAR + fy * FH;
  const o = Math.min(1, p * 1.4) * out;
  const pulse = 1 + 0.25 * Math.sin(frame / 5);
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: o, pointerEvents: "none" }}>
        <line x1={x} y1={y} x2={x + (lx - x) * p} y2={y + (ly - y) * p} stroke={C.accent} strokeWidth={3} />
        <circle cx={x} cy={y} r={10 * pulse} fill="none" stroke={C.accent} strokeWidth={3} />
        <circle cx={x} cy={y} r={5} fill={C.accent} />
      </svg>
      <div style={{ position: "absolute", left: lx, top: ly, transform: `translate(-50%, -50%) scale(${interpolate(p, [0, 1], [0.7, 1])})`, opacity: o }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 25, color: C.bg, background: C.accent, padding: "10px 18px", borderRadius: 12, whiteSpace: "nowrap", boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}>
          {children}
        </div>
      </div>
    </>
  );
};

/** Left: the real recording. Right: what is happening under the hood. */
export const Footage: React.FC<{ clip: string; tag: string; step: number; url?: string; overlay?: React.ReactNode; children: React.ReactNode }> = ({ clip, tag, step, url, overlay, children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inP = spring({ frame, fps, config: { damping: 16 } });
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Bg />
      <div style={{ position: "absolute", left: FX, top: FY, transform: `translateY(${interpolate(inP, [0, 1], [60, 0])}px)`, opacity: Math.min(1, inP * 1.5) }}>
        <Browser src={clip} url={url} />
        <div style={{ position: "absolute", top: -50, left: 0, display: "flex", gap: 12 }}>
          <Chip size={17} bg={C.red} color="#fff" style={{ padding: "6px 14px", borderRadius: 999, border: "none", fontFamily: mono, letterSpacing: "0.08em" }}>
            ● REAL RUN · {tag}
          </Chip>
        </div>
      </div>
      {overlay}
      <div style={{ position: "absolute", left: 1280, right: 70, top: 196, bottom: 150 }}>{children}</div>
      <Steps active={step} />
    </AbsoluteFill>
  );
};

const STEPS = ["Upload", "Stage", "Prove", "Generate", "Export"];

export const Steps: React.FC<{ active: number }> = ({ active }) => (
  <div style={{ position: "absolute", left: FX, bottom: 62, display: "flex", gap: 14, alignItems: "center" }}>
    {STEPS.map((name, i) => (
      <React.Fragment key={name}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: i === active ? C.bg : i < active ? C.text : C.muted,
            background: i === active ? C.accent : "transparent",
            border: `1.5px solid ${i === active ? C.accent : C.line}`,
            padding: "8px 14px",
            borderRadius: 10,
          }}
        >
          {i + 1} {name}
        </div>
        {i < STEPS.length - 1 ? <div style={{ width: 18, height: 2, background: C.line }} /> : null}
      </React.Fragment>
    ))}
  </div>
);

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
