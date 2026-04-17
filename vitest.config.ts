import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import react from "@vitejs/plugin-react";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["src/__tests__/setup.tsx"],
    // Unit + integration only; exclude Playwright e2e (tests/e2e, *.spec.ts)
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "tests/e2e/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(dir, "./src"),
    },
  },
});
