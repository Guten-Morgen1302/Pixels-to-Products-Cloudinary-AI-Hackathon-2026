import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, display, mono } from "./theme";

/** YouTube thumbnail 1280×720: the 3-model studio and the brass WhatsApp file, both real frames from the 1 Oct recording. */
const Shot: React.FC<{ src: string; rotate: number; left: number; top: number; w: number; h: number; pos?: string }> = ({ src, rotate, left, top, w, h, pos = "center" }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      padding: 8,
      borderRadius: 22,
      background: "#050706",
      transform: `rotate(${rotate}deg)`,
      boxShadow: "0 30px 70px rgba(0,0,0,0.65), 0 0 0 2px #26302b",
    }}
  >
    <div style={{ width: w, height: h, borderRadius: 15, overflow: "hidden" }}>
      <Img src={staticFile(src)} style={{ width: w, height: h, objectFit: "cover", objectPosition: pos }} />
    </div>
  </div>
);

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at 76% 45%, #0f3a28 0%, ${C.bg} 58%)`, overflow: "hidden" }}>
    <Shot src="stills/studio.png" rotate={-7} left={600} top={110} w={600} h={282} />
    <Shot src="stills/brass.png" rotate={6} left={850} top={250} w={350} h={372} />

    <div style={{ position: "absolute", left: 56, top: 56, width: 620 }}>
      <div
        style={{
          display: "inline-block",
          fontFamily: mono,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: "0.12em",
          color: C.bg,
          background: C.accent,
          padding: "8px 16px",
          borderRadius: 10,
        }}
      >
        BUILT ON CLOUDINARY
      </div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 124, lineHeight: 0.9, letterSpacing: "-0.045em", color: C.text, marginTop: 30 }}>
        Real
        <br />
        product.
      </div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 124, lineHeight: 0.9, letterSpacing: "-0.045em", color: C.accent, marginTop: 10 }}>
        AI stage.
      </div>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 36, color: C.text, marginTop: 34 }}>
        1 photo → 4 marketplace sizes
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        right: 36,
        bottom: 30,
        fontFamily: display,
        fontWeight: 800,
        fontSize: 34,
        color: C.text,
        background: "rgba(10,13,12,0.88)",
        padding: "10px 20px",
        borderRadius: 14,
        border: `2px solid ${C.accent}`,
      }}
    >
      <span style={{ color: C.accent }}>●</span> RealStage
    </div>
  </AbsoluteFill>
);
