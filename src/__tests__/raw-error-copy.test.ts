import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { actionErrorKey, returnedErrorKey } from "@/lib/action-error";

/**
 * Kullanıcıya HAM hata metni gösterilmez.
 *
 * NEDEN (2026-08-24'te ölçüldü): 12 yönetim ekranı `catch` bloğunda
 * `toast.error(error instanceof Error ? error.message : String(error))` yazıyordu.
 * İki ayrı sonuç:
 *
 *   - **Prod**: Next 16 server action'dan fırlayan hatayı istemciye kırparak
 *     gönderiyor; ekrana düşen şey şu İngilizce paragraf oluyordu — 6 dilin
 *     hepsinde, hangi alanın yanlış olduğunu söylemeden:
 *     "An error occurred in the Server Components render. The specific message
 *      is omitted in production builds to avoid leaking sensitive details. …"
 *   - **Geliştirme**: `admin-management.ts` `Errors.invalidData` diye fırlatıyor
 *     ve ham anahtar birebir ekrana basılıyordu.
 *
 * Belirli bir sebebin kullanıcıya ulaşması gerekiyorsa yol fırlatmak değil,
 * `{ success: false, error: "Errors.x" }` dönüşüdür — o kırpılmaz.
 */

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("ham hata metni sızmıyor", () => {
  it("hiçbir bileşen yakalanan hatanın `.message`'ını ekrana basmıyor", () => {
    const offenders: string[] = [];
    for (const f of walk(path.join(process.cwd(), "src/components"))) {
      const src = stripComments(fs.readFileSync(f, "utf8"));
      // toast.error(...) / setError(...) içinde ham Error.message
      const re =
        /(toast\.error|setError|setErr)\(\s*[^)]*\b(?:e|err|error|caughtError)\s+instanceof\s+Error\s*\?/g;
      if (re.test(src)) offenders.push(path.relative(process.cwd(), f));
    }
    expect(
      offenders,
      `Bu dosyalar ham hata metni gösteriyor. Prod'da o metin zaten kırpılıyor; ` +
        `\`actionErrorKey\` + \`useTranslations("Errors")\` kullanın:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("bilinmeyen hata yerelleştirilmiş genel anahtara düşer", () => {
    expect(actionErrorKey(new Error("boom"))).toBe("generic");
    expect(actionErrorKey(new Error("Unauthorized"))).toBe("generic");
    expect(actionErrorKey(undefined)).toBe("generic");
    // Prod'da gerçekten gelen metin — birebir bu.
    expect(
      actionErrorKey(
        new Error(
          "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.",
        ),
      ),
    ).toBe("generic");
  });

  it("tanınan anahtar korunur ve `Errors.` öneki soyulur", () => {
    expect(actionErrorKey(new Error("Errors.invalidData"))).toBe("invalidData");
    expect(actionErrorKey(new Error("invalidData"))).toBe("invalidData");
  });

  it("döndürülen her anahtarın 6 dilde karşılığı var", () => {
    const keys = [
      "generic",
      "invalidData",
      "unauthorized",
      "notAuthorizedAdmin",
      "authRequired",
      "bookingNotFound",
      "bookingStateConflict",
    ];
    for (const loc of ["tr", "en", "de", "fr", "fa", "ja"]) {
      const messages = JSON.parse(
        fs.readFileSync(`src/locales/${loc}.json`, "utf8"),
      );
      for (const k of keys) {
        expect(messages.Errors?.[k], `${loc}.Errors.${k} yok`).toBeTruthy();
      }
    }
  });
});

/**
 * MANDAL 2 — `{ success: false, error: ... }` DÖNÜŞ yolu.
 *
 * Yukarıdaki mandal FIRLATILAN hatayı kovalıyordu. 2026-08-25 taraması ikinci,
 * daha yaygın bir sızıntı buldu: action'lar `error` alanında üç ayrı biçim
 * döndürüyordu (çeviri anahtarı, snake_case kod, servisin Türkçe cümlesi) ve
 * 10 ekran gelen değeri OLDUĞU GİBİ basıyordu. Somut sonuçlar:
 *
 *   - Rezervasyonunu iptal edemeyen misafir ekranda "Errors.bookingNotFound"
 *     okuyordu (`BookingDetailActions`).
 *   - Mühür talebi reddedilen esnaf "tracking_number_required" okuyordu
 *     (`SealShipButton`, `PartnerSealsClient`).
 *   - Japonca arayüzdeki esnaf check-in hatasını TÜRKÇE okuyordu
 *     (`partner.ts` servis cümlesini geçiriyordu).
 *
 * İki ayrı şey ölçülüyor: (1) koddaki her `Errors.x` referansının sözlükte
 * karşılığı var mı, (2) hiçbir ekran dönüş değerini ham basıyor mu.
 */
describe("dönüş yolundaki hata alanı ham basılmıyor", () => {
  const SOURCE_ROOTS = ["src/actions", "src/app", "src/components", "src/lib", "src/services"];

  function sources(): string[] {
    return SOURCE_ROOTS.flatMap((r) => walk(path.join(process.cwd(), r))).filter(
      (f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"),
    );
  }

  it("koddaki her `Errors.x` referansının sözlükte karşılığı var", () => {
    // 2026-08-25'te DORT anahtar sarkiyordu: `invalidInput` (contact + partner),
    // `invalidPhone` (booking), `notFound` ve `emailSendFailed` (contact).
    // Sozlukte olmayan bir anahtar ekrana anahtarin KENDISINI basar — yani
    // duzeltmeye calistigimiz hatanin ta kendisi, sessiz halde.
    const dict = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "src/locales/tr.json"), "utf8"),
    ) as { Errors: Record<string, string> };
    const known = new Set(Object.keys(dict.Errors));

    const dangling: string[] = [];
    for (const f of sources()) {
      const src = stripComments(fs.readFileSync(f, "utf8"));
      for (const m of src.matchAll(/["'`]Errors\.([A-Za-z0-9_]+)["'`]/g)) {
        if (!known.has(m[1])) dangling.push(`${path.relative(process.cwd(), f)} → Errors.${m[1]}`);
      }
    }
    expect(
      [...new Set(dangling)],
      "Bu anahtarların `Errors` sözlüğünde karşılığı yok; ekranda anahtar adı görünür:",
    ).toEqual([]);
  });

  it("hiçbir bileşen action'ın `error` alanını doğrudan göstermiyor", () => {
    // `toast.error` / `setError` / `setErr` GOSTERIM ILKELLERIDIR. Bir action'in
    // `error` alani buraya HAM giremez; once `useActionErrorText` ile anahtara
    // indirgenip cevrilmeli. (Yerel sarmalayicilar — `showError` gibi — bu
    // ilkelleri kendi govdesinde zaten cevrilmis metinle cagirir.)
    const re = /(?:toast\.error|setError|setErr)\(\s*(?:res|result)\.error\b/;
    const offenders: string[] = [];
    for (const f of walk(path.join(process.cwd(), "src/components"))) {
      if (re.test(stripComments(fs.readFileSync(f, "utf8")))) {
        offenders.push(path.relative(process.cwd(), f));
      }
    }
    expect(
      offenders,
      "Bu dosyalar sunucudan geleni ham gösteriyor. `useActionErrorText()` kullanın:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("returnedErrorKey — dönüş değerini anahtara indirger", () => {
  it("`Errors.` önekli anahtarı çıplak anahtara çevirir", () => {
    expect(returnedErrorKey("Errors.bookingNotFound")).toBe("bookingNotFound");
    expect(returnedErrorKey("Errors.generic")).toBe("generic");
  });

  it("eski snake_case kodları eşler", () => {
    // `seal.ts` bu kodlari donmeye devam ediyor (mobil/API sozlesmesi sabit);
    // eslemenin GOSTERIM aninda olmasinin sebebi bu.
    expect(returnedErrorKey("tracking_number_required")).toBe("sealTrackingRequired");
    expect(returnedErrorKey("request_not_pending")).toBe("sealRequestNotPending");
    expect(returnedErrorKey("unauthorized")).toBe("unauthorized");
    expect(returnedErrorKey("unknown")).toBe("generic");
  });

  it("serbest metni ANAHTAR SAYMAZ — asıl hata buydu", () => {
    // Servisin Turkce cumlesi ve ham `Error.message` buraya dusuyordu; `null`
    // donmesi "gosterme, cagiranin yerellestirilmis yedegini kullan" demek.
    expect(returnedErrorKey("Rezervasyon bulunamadı.")).toBeNull();
    expect(returnedErrorKey("Bu tarih aralığında dükkan kapasitesi yetersiz.")).toBeNull();
    expect(returnedErrorKey("")).toBeNull();
    expect(returnedErrorKey(undefined)).toBeNull();
    expect(returnedErrorKey(null)).toBeNull();
  });
});
