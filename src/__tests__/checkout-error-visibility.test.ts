import { describe, it, expect } from "vitest";
import fs from "node:fs";

/**
 * Ödeme akışında ayarlanan HER hata ekranda görünmelidir.
 *
 * NEDEN (2026-08-24): `CheckoutClient` footer'daki hata bloğu `step === 1` ile
 * kısıtlıydı. Üye girişi yapmış misafir 2. adımda "gönder"e bastığında sunucu
 * hatası (kapasite dolu, geçersiz kupon, kapalı slot) `setError(...)` ile
 * yazılıyor ama HİÇBİR YERDE render edilmiyordu — ne footer'da ne 2. adımın
 * gövdesinde. Ekranda hiçbir şey değişmediği için akış "tıkla, hiçbir şey
 * olmuyor"a dönüyordu; dönüşüm yolunun son adımında sessiz çıkmaz.
 *
 * Aynı hata sınıfı daha önce misafir modalı için düzeltilmişti — yani kusur
 * bileşende değil KALIPTAYDI: hata durumu bir adıma bağlanırsa diğer adımda
 * kaybolur. Bu tarama o kalıbı geri gelemez hâle getirir.
 */

const SOURCE = "src/components/guest/CheckoutClient.tsx";

/** Yorum satırları sayılmaz — yalnızca gerçek kod. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("checkout hata görünürlüğü", () => {
  const code = stripComments(fs.readFileSync(SOURCE, "utf8"));

  it("hata bloğu belirli bir adıma bağlanmaz", () => {
    // `step === N && error` / `error && step === N` kalıbı: hatayı tek bir
    // adımda hapseder, diğer adımlarda sessizce yutar.
    const stepGated = /(step\s*===\s*\d+\s*&&\s*error)|(error\s*&&\s*step\s*===\s*\d+)/;
    expect(code).not.toMatch(stepGated);
  });

  it("hata metni role=\"alert\" ile duyurulur", () => {
    expect(code).toMatch(/role="alert"/);
  });

  it("son adımın gönder butonu hatayı tetikleyebildiği için hata render edilir", () => {
    // `setError` çağrısı varsa, karşılığında `{error &&` render'ı da olmalı.
    expect(code).toMatch(/setError\(/);
    expect(code).toMatch(/\{error\s*&&/);
  });
});
