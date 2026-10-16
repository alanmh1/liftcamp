import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests do not load the TanStack Start and
// Nitro plugins. Only the @ alias is needed.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
