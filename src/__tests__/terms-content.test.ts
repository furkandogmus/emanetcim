import { describe, expect, it } from "vitest";

import { termsLanguageFor, termsSections } from "@/lib/legal/terms-content";

const shape = (lang: "tr" | "en", paymentMode: "online" | "onsite") =>
  termsSections(lang, { companyLegalName: "Örnek Ltd.", paymentMode }).map((s) => [
    s.title.split(".")[0],
    s.paragraphs.map((p) => (Array.isArray(p) ? `list:${p.length}` : p.split(" ")[0])),
  ]);

describe("kullanim kosullari", () => {
  it("Ingilizce ceviri Turkce metinle ayni bolum ve madde yapisinda (iki odeme modunda)", () => {
    for (const mode of ["online", "onsite"] as const) {
      expect(shape("en", mode)).toEqual(shape("tr", mode));
    }
  });

  it("unvan yoksa 1.1 iki dilde de cizilmez", () => {
    for (const lang of ["tr", "en"] as const) {
      const first = termsSections(lang, { companyLegalName: "", paymentMode: "onsite" })[0];
      expect(String(first.paragraphs[0]).startsWith("1.2.")).toBe(true);
    }
  });

  it("Turkce yalnizca tr icin; diger diller Ingilizce", () => {
    expect(termsLanguageFor("tr")).toBe("tr");
    for (const l of ["en", "de", "fr", "fa", "ja"]) expect(termsLanguageFor(l)).toBe("en");
  });
});
