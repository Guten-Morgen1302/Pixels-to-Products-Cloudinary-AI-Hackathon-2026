import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const display = loadDisplay("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;
export const emoji = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';

export const C = {
  bg: "#0a0d0c",
  bg2: "#0f1714",
  panel: "#141b18",
  line: "#25302b",
  text: "#f2f5f3",
  muted: "#93a39b",
  accent: "#2ee59d", // RealStage green, brightened for a dark canvas: the one accent
  accentSoft: "#86f2c6",
  red: "#ff5c61",
  amber: "#ffb547",
};

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);
