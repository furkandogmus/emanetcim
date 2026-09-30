import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import GLOBAL_ERROR_COPY from "@/app/global-error-copy.json";

describe("global-error metinleri dil dosyalarıyla aynı", () => {
  for (const [locale, copy] of Object.entries(GLOBAL_ERROR_COPY)) {
    it(locale, () => {
      const messages = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), `src/locales/${locale}.json`), "utf8"),
      );
      for (const [key, value] of Object.entries(copy)) {
        expect(value).toBe(messages.Common[key]);
      }
    });
  }
});
