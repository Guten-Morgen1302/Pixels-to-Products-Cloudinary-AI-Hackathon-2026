import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Tests must never reach Cloudinary's paid generation endpoint (Budget Lock rule 2).
    setupFiles: ["test/setup.ts"],
  },
});
