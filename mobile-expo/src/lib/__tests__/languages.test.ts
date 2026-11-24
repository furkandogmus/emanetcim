/** D9: fr/ja uygulama dili, cihaz dili secimi ve site/e-posta eslemesi. */
import { describe, expect, it } from "@jest/globals";
import i18n from "../i18n";
import { APP_LANGUAGES, deviceLanguage, languageInfo } from "../languages";

describe("deviceLanguage", () => {
  it("Fransizca ve Japonca telefon kendi dilinde acilir", () => {
    expect(deviceLanguage(["fr"])).toBe("fr");
    expect(deviceLanguage(["ja"])).toBe("ja");
  });

  it("ilk desteklenen tercihi alir, desteklenmeyeni atlar", () => {
    expect(deviceLanguage(["es", "fr", "en"])).toBe("fr");
    expect(deviceLanguage(["ko", null, "JA"])).toBe("ja");
  });

  it("hic desteklenen yoksa Ingilizce", () => {
    expect(deviceLanguage(["es", "it"])).toBe("en");
    expect(deviceLanguage([])).toBe("en");
  });
});

describe("languageInfo", () => {
  it("fr/ja site ve e-posta icin kendi dilini kullanir", () => {
    expect(languageInfo("fr")).toMatchObject({ intl: "fr-FR", site: "fr", label: "Français" });
    expect(languageInfo("ja")).toMatchObject({ intl: "ja-JP", site: "ja", label: "日本語" });
  });

  it("her uygulama dilinin cevirisi yuklu", () => {
    for (const { value } of APP_LANGUAGES) expect(i18n.hasResourceBundle(value, "translation")).toBe(true);
  });
});

describe("fr/ja cogul", () => {
  it("Fransizca 0 ve 1 tekil, Japonca tek bicim", () => {
    const fr = i18n.getFixedT("fr");
    const ja = i18n.getFixedT("ja");
    expect(fr("common.day", { count: 1 })).not.toEqual(fr("common.day", { count: 2 }));
    expect(fr("common.day", { count: 0 })).toEqual(fr("common.day", { count: 1 }).replace("1", "0"));
    expect(ja("common.day", { count: 3 })).toContain("3");
  });
});

describe("fa", () => {
  it("Farsca telefon Farsca acilir; site ve tarih fa", () => {
    expect(deviceLanguage(["fa"])).toBe("fa");
    expect(languageInfo("fa")).toMatchObject({ intl: "fa-IR", site: "fa", label: "فارسی" });
  });

  it("cogul one/other ve sayi metinde", () => {
    const fa = i18n.getFixedT("fa");
    expect(fa("common.day", { count: 3 })).toContain("3");
    expect(fa("common.day", { count: 3 })).not.toContain("common.day");
  });
});
