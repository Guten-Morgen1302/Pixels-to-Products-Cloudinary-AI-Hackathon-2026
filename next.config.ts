import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp and the Cloudinary SDK run only in Node route handlers.
  serverExternalPackages: ["sharp", "cloudinary"],
  images: { unoptimized: true }, // Cloudinary already does f_auto/q_auto; no double optimization.
};

export default nextConfig;
