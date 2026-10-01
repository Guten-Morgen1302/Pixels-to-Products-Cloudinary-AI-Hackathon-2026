import React from "react";
import { AbsoluteFill, Composition, Series } from "remotion";
import {
  BrassScene,
  CompareScene,
  CutoutScene,
  DownloadScene,
  FilesScene,
  GenerateScene,
  GithubScene,
  LandingScene,
  RelightScene,
  StudioScene,
} from "./footage";
import { ColdOpen, Logo, Problem } from "./intro";
import { End, Pipeline, Stats } from "./outro";
import { C as T, FPS, s } from "./theme";
import { Thumbnail } from "./thumbnail";

// Footage scenes last exactly as many frames as their clip (video/public/clips, cut by video/cut_clips.sh).
const SCENES: { C: React.FC; d: number }[] = [
  { C: ColdOpen, d: s(6) },
  { C: Logo, d: s(4.5) },
  { C: Problem, d: s(8) },
  { C: LandingScene, d: 150 },
  { C: CutoutScene, d: 150 },
  { C: StudioScene, d: 300 },
  { C: CompareScene, d: 105 },
  { C: RelightScene, d: 300 },
  { C: GenerateScene, d: 330 },
  { C: BrassScene, d: 270 },
  { C: DownloadScene, d: 180 },
  { C: FilesScene, d: 296 },
  { C: GithubScene, d: 223 },
  { C: Pipeline, d: s(12) },
  { C: Stats, d: s(9) },
  { C: End, d: s(8) },
];

export const TOTAL = SCENES.reduce((a, b) => a + b.d, 0);

const Main: React.FC = () => (
  <AbsoluteFill style={{ background: T.bg }}>
    <Series>
      {SCENES.map(({ C, d }, i) => (
        <Series.Sequence key={i} durationInFrames={d}>
          <C />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="RealStage" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1280} height={720} />
  </>
);
