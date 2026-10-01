import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { Callout, Chip, Code, Footage, H, Kicker, P, Pop, Slam } from "./ui";
import { C, mono, s } from "./theme";

/* All footage: the real 1 Oct 2026 run on localhost:3000 (live Cloudinary, live AI), only cropped + sped up.
   Times below are seconds inside each sped-up clip (source mapping in video/README.md). */

export const LandingScene: React.FC = () => (
  <Footage clip="clips/c1_landing.mp4" tag="1.5×" step={0} overlay={<Callout at={1.2} fx={0.22} fy={0.53} lx={420} ly={872}>Upload one real photo</Callout>}>
    <Kicker>Step 1 · the seller's photo</Kicker>
    <H size={66} style={{ marginTop: 16 }}>
      One phone photo.
      <br />
      <span style={{ color: C.accent }}>That's the input.</span>
    </H>
    <Pop at={1.6}>
      <P size={28} style={{ marginTop: 34 }}>Signed upload goes straight from the browser to Cloudinary (up to 10 MB), never through our server.</P>
    </Pop>
  </Footage>
);

export const CutoutScene: React.FC = () => (
  <Footage clip="clips/c2_cutout.mp4" tag="8.6× · 43 s → 5 s" step={0} overlay={<Callout at={0.6} until={3.6} fx={0.2} fy={0.52} lx={460} ly={872}>e_background_removal</Callout>}>
    <Kicker>Cutout, once</Kicker>
    <H size={66} style={{ marginTop: 16 }}>
      Cloudinary removes
      <br />
      <span style={{ color: C.accent }}>the background.</span>
    </H>
    <div style={{ marginTop: 36 }}>
      <Code
        at={1.0}
        step={0.5}
        size={21}
        lines={[
          { t: "e_background_removal/e_trim/f_png", c: C.accent },
          { t: "→ saved once as <photo>_cut", c: C.muted },
          { t: "→ every stage reuses it: paid once", c: C.muted },
        ]}
      />
    </div>
  </Footage>
);

export const StudioScene: React.FC = () => (
  <Footage
    clip="clips/c3_studio.mp4"
    tag="2.6×"
    step={1}
    overlay={
      <>
        <Callout at={0.6} until={4.2} fx={0.94} fy={0.05} lx={980} ly={112}>live AI budget: 15 of 15</Callout>
        <Callout at={5.2} fx={0.6} fy={0.8} lx={760} ly={872}>same scene · 3 different models</Callout>
      </>
    }
  >
    <Kicker>Model choice, on screen</Kicker>
    <H size={64} style={{ marginTop: 16 }}>
      Same product.
      <br />
      <span style={{ color: C.accent }}>3 AI models.</span>
    </H>
    <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
      {[
        ["flux-2-klein-9b", "seed 1000"],
        ["nano-banana-1", "seed 1001"],
        ["recraft-v3", "seed n/a"],
      ].map(([m, sd], i) => (
        <Pop key={m} at={1.2 + i * 0.5} from="left">
          <Chip size={24}>
            <span style={{ fontFamily: mono, color: C.accent }}>{m}</span> · <span style={{ fontFamily: mono, fontSize: 21, color: C.muted }}>{sd}</span>
          </Chip>
        </Pop>
      ))}
    </div>
    <Pop at={3.4}>
      <P size={26} style={{ marginTop: 30 }}>Stages come from Cloudinary <b style={{ color: C.text }}>text_to_image</b>. The teapot is composited on top with Cloudinary layers, so these cost 0 credits to use.</P>
    </Pop>
  </Footage>
);

export const CompareScene: React.FC = () => (
  <Footage clip="clips/c4_compare.mp4" tag="1×" step={2}>
    <Kicker>Proof</Kicker>
    <div style={{ marginTop: 26 }}>
      <Slam at={0.2} size={92}>Same</Slam>
      <Slam at={0.6} size={92} color={C.accent} style={{ marginTop: 6 }}>pixels.</Slam>
    </div>
    <Pop at={1.2}>
      <P size={28} style={{ marginTop: 34 }}>Compare: your photo vs the same crop on stage, at identical scale.</P>
    </Pop>
  </Footage>
);

export const RelightScene: React.FC = () => {
  return (
    <Footage
      clip="clips/c5_relight.mp4"
      tag="3× · LIVE AI"
      step={2}
      overlay={
        <>
          <Callout at={0.3} until={3.2} fx={0.81} fy={0.19} lx={900} ly={112}>Relight with AI · 3 credits</Callout>
          <Callout at={8.4} fx={0.86} fy={0.79} lx={760} ly={872}>AI moved the teapot → exact photo kept</Callout>
        </>
      }
    >
      <Kicker>Relight + Pixel-Lock</Kicker>
      <H size={60} style={{ marginTop: 16 }}>
        AI relights.
        <br />
        <span style={{ color: C.accent }}>Code checks it.</span>
      </H>
      <div style={{ marginTop: 34 }}>
        <Code
          at={1.2}
          step={0.6}
          size={20}
          lines={[
            { t: "image_to_image  ref [1] = composite", c: C.muted },
            { t: "edge-map NCC inside the cutout mask" },
            { t: "moved?  → reject, keep exact photo", c: C.amber },
            { t: "aligned → lock original pixels on top", c: C.accent },
          ]}
        />
      </div>
      <Pop at={8.4}>
        <Chip size={24} color={C.bg} bg={C.amber} style={{ marginTop: 26, border: "none" }}>
          This run: the model shifted the product. Rejected.
        </Chip>
      </Pop>
    </Footage>
  );
};

export const GenerateScene: React.FC = () => (
  <Footage
    clip="clips/c6_generate.mp4"
    tag="4× · LIVE AI"
    step={3}
    overlay={
      <>
        <Callout at={3.2} until={6.4} fx={0.5} fy={0.875} lx={650} ly={872}>each model shows its real price</Callout>
        <Callout at={9.4} fx={0.17} fy={0.55} lx={460} ly={872}>Flux · 3 seeded variations</Callout>
      </>
    }
  >
    <Kicker>Variations, live</Kicker>
    <H size={60} style={{ marginTop: 16 }}>
      "brass thali table,
      <br />
      <span style={{ color: C.accent }}>festive evening"</span>
    </H>
    <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
      {[
        ["Flux", "3 variations", "3 credits"],
        ["Nano Banana", "1 image", "4 credits"],
        ["Recraft", "1 image", "4 credits"],
      ].map(([m, n, c], i) => (
        <Pop key={m} at={1.0 + i * 0.4} from="left">
          <Chip size={24} style={i === 0 ? { borderColor: C.accent } : undefined}>
            {m} · {n} · <span style={{ fontFamily: mono, color: C.accent }}>{c}</span>
          </Chip>
        </Pop>
      ))}
    </div>
    <Pop at={4.2}>
      <P size={24} style={{ marginTop: 26 }}>Credit costs measured from Cloudinary's own used_by_request, not guessed.</P>
    </Pop>
  </Footage>
);

export const BrassScene: React.FC = () => (
  <Footage clip="clips/c7_brass.mp4" tag="2×" step={3} overlay={<Callout at={1.6} fx={0.25} fy={0.92} lx={560} ly={872}>generated just now · real seeds</Callout>}>
    <Kicker>3 new stages</Kicker>
    <H size={64} style={{ marginTop: 16 }}>
      Brass. Marigolds.
      <br />
      <span style={{ color: C.accent }}>Same teapot.</span>
    </H>
    <Pop at={2.4}>
      <P size={28} style={{ marginTop: 34 }}>AI drew the table. The teapot is still the photo that was uploaded.</P>
    </Pop>
  </Footage>
);

export const DownloadScene: React.FC = () => (
  <Footage clip="clips/c8_download.mp4" tag="2×" step={4} overlay={<Callout at={0.5} fx={0.82} fy={0.69} lx={760} ly={872}>Download all · zipped in the browser</Callout>}>
    <Kicker>The kit</Kicker>
    <H size={64} style={{ marginTop: 16 }}>
      One click.
      <br />
      <span style={{ color: C.accent }}>Four files.</span>
    </H>
    <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      {["Amazon main · 2000×2000 white", "Instagram · 1080×1350", "Story · 1080×1920", "WhatsApp / Meesho · 1080×1080"].map((k, i) => (
        <Pop key={k} at={1.4 + i * 0.35} from="left">
          <Chip size={23}>{k}</Chip>
        </Pop>
      ))}
    </div>
  </Footage>
);

export const FilesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const white = spring({ frame: frame - s(7.6), fps: 30, config: { damping: 12 } });
  return (
    <Footage clip="clips/c9_files.mp4" tag="WINDOWS PHOTOS · 4 CUTS" step={4} url="downloaded files" overlay={<Callout at={0.4} until={3.4} fx={0.5} fy={0.03} lx={650} ly={872}>real file names: realstage-1-hero-teapot-…</Callout>}>
      <Kicker>Opened from the zip</Kicker>
      <H size={64} style={{ marginTop: 16 }}>
        Ready to <span style={{ color: C.accent }}>list.</span>
      </H>
      <P size={26} style={{ marginTop: 26 }}>Social sizes keep the stage at native pixels over a blurred backdrop: no upscaling.</P>
      <div style={{ marginTop: 30, opacity: white, transform: `scale(${interpolate(white, [0, 1], [0.8, 1])})`, transformOrigin: "left center" }}>
        <Chip size={26} color={C.bg} bg={C.accent} style={{ border: "none" }}>
          Amazon: 99.9% of background pixels ≥ 254, checked in code
        </Chip>
      </div>
    </Footage>
  );
};

export const GithubScene: React.FC = () => (
  <Footage clip="clips/c10_github.mp4" tag="1×" step={4} url="github.com/Guten-Morgen1302/Pixels-to-Products-…">
    <Kicker>Open source</Kicker>
    <H size={60} style={{ marginTop: 16 }}>
      Every Cloudinary call,
      <br />
      <span style={{ color: C.accent }}>mapped to a file.</span>
    </H>
    <Pop at={1.2}>
      <P size={28} style={{ marginTop: 34 }}>
        README → <span style={{ fontFamily: mono, color: C.text, fontSize: 24 }}>Cloudinary integration (feature map)</span>
      </P>
    </Pop>
  </Footage>
);

