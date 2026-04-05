import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Unit + integration only; exclude Playwright e2e (tests/e2e, *.spec.ts)
    include: ["src/**/*.test.ts"],
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
