import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--font-display", display: "swap" });
const ui = Instrument_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-ui", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "RealStage: your real product, studio stages, every marketplace size",
  description: "Upload one phone photo. Cloudinary cuts out your real product, places it on AI-generated stages from 3 models, and exports Amazon, Instagram, Story and WhatsApp sizes.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions inject attributes on <html> before React loads (one level only).
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
