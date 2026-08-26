import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  PLATFORM_TIMEZONE,
  parseDatetimeLocalInTimeZone,
  toDatetimeLocalValueInTimeZone,
} from "@/lib/datetime-local";

/**
 * Müsaitlik ızgarası ile checkout state'i arasındaki BİÇİM SÖZLEŞMESİ.
 *
 * NEDEN (2026-08-24'te ölçüldü): `SlotAvailabilityGrid`, seçilen aralığı
 * `onSelectRange` ile HAM ISO anı olarak veriyordu ("2026-08-24T09:30:00.000Z")
 * ve `CheckoutClient` bunu doğrudan `setCheckInLocal`'a yazıyordu. O state bir
 * `datetime-local` DUVAR SAATİ bekliyor. `parseDatetimeLocalInTimeZone` gelen
 * değerin sonuna koşulsuz "Z" ekliyor → "...000Z" + "Z" = "...000ZZ" →
 * Invalid Date → `null`.
 *
 * Ölçülen sonuç: iki slot'a dokunarak aralık seçmek `windowOk`'u FALSE yapıyor,
 * "devam" butonu sönüyor ve kullanıcı "tarih geçersiz" uyarısı alıyordu. Yani
 * ızgarayı amacına uygun kullanmak rezervasyonu bozuyordu.
 *
 * Bu tarama iki şeyi sabitler: (1) tuzağın hâlâ tuzak olduğu — ham ISO parse
 * edilemez, (2) ızgaranın sınırda çeviri yaptığı.
 */
/**
 * Yorum satırları sayılmaz — yalnızca gerçek kod.
 *
 * Blok yorumlar ÖNCE silinir (diğer taramalarla aynı sıra). JSX yorumunu
 * `{/* … *\/}` olarak ayrıca eşlemeye çalışmak bu dosyada kod yutuyordu:
 * `catch {` + blok yorum dizilimi, kapanışı bulmak için bir sonraki `*\/}`
 * çiftine kadar uzayıp aradaki gerçek kodu siliyor.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("slot aralığı ↔ checkout biçim sözleşmesi", () => {
  const apiIso = "2026-08-24T09:30:00.000Z";

  it("ham API ISO'su checkout state'ine yazılamaz (null'a düşer)", () => {
    expect(parseDatetimeLocalInTimeZone(apiIso)).toBeNull();
  });

  it("duvar saatine çevrilmiş değer parse edilir ve AYNI anı korur", () => {
    const wall = toDatetimeLocalValueInTimeZone(new Date(apiIso), PLATFORM_TIMEZONE);
    expect(wall).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    const parsed = parseDatetimeLocalInTimeZone(wall, PLATFORM_TIMEZONE);
    expect(parsed).not.toBeNull();
    // Dakika hassasiyetinde gidiş-dönüş: saniye alanı duvar saatinde yok.
    expect(parsed!.getTime()).toBe(new Date(apiIso).getTime());
  });

  it("ızgara duvar saatine sınırda çevirir; cihazın saat dilimini kullanmaz", () => {
    // Yorumlar sayılmaz: bu dosya hatanın kendisini yorumda ANLATIYOR.
    const src = stripComments(
      fs.readFileSync("src/components/guest/SlotAvailabilityGrid.tsx", "utf8"),
    );

    // Çeviri sınırda yapılmalı.
    expect(src).toMatch(/onSelectRange\(\s*toWallValue\(/);

    // Cihaz saat dilimi okuyan API'ler slot etiketinde kullanılamaz: turistin
    // telefonu memleket saatindeyken dükkanın takvimiyle uyuşmaz.
    expect(src).not.toMatch(/\.getHours\(\)/);
    expect(src).not.toMatch(/setHours\(/);
  });

  /**
   * Saat dilimi UÇTAN UCA tek parametre.
   *
   * NEDEN: `SlotService` müsaitliği `Shop.timezone`'da üretiyor, ama checkout
   * her yerde `parseDatetimeLocalInTimeZone`'un VARSAYILANINI (İstanbul)
   * kullanıyordu. Bugün üç dükkan da İstanbul olduğu için ikisi tesadüfen
   * örtüşüyor; İstanbul dışı ilk dükkan eklendiğinde misafirin ızgarada
   * gördüğü saat ile rezervasyona yazılan an ofset kadar ayrışır — hatanın
   * kendisi de sessizdir, ekranda hiçbir uyarı yoktur.
   */
  it("checkout ve ızgara dükkanın dilimini alır; varsayılana düşmez", () => {
    const checkout = stripComments(
      fs.readFileSync("src/components/guest/CheckoutClient.tsx", "utf8"),
    );

    expect(checkout).toMatch(/timeZone\?: string/);
    expect(checkout).toMatch(/parseDatetimeLocalInTimeZone\(checkInLocal, timeZone\)/);
    expect(checkout).toMatch(/parseDatetimeLocalInTimeZone\(checkOutLocal, timeZone\)/);
    expect(checkout).toMatch(/<SlotAvailabilityGrid[\s\S]*?timeZone=\{timeZone\}/);

    // Sayfa dükkanın kendi dilimini geçirmeli.
    const page = stripComments(
      fs.readFileSync("src/app/[locale]/checkout/[shopId]/page.tsx", "utf8"),
    );
    expect(page).toMatch(/timeZone=\{shop\.timezone/);
  });

  /**
   * Dilim gerçekten farklı bir ana çözülüyor mu — sözleşme değil, davranış.
   * Aynı duvar saati Tokyo'da ve İstanbul'da farklı UTC anıdır; ikisi eşit
   * çıkarsa parametre bir yerde yutuluyor demektir.
   */
  it("aynı duvar saati farklı dilimlerde farklı ana çözülür", () => {
    const wall = "2026-08-24T09:30";
    const ist = parseDatetimeLocalInTimeZone(wall, "Europe/Istanbul");
    const tokyo = parseDatetimeLocalInTimeZone(wall, "Asia/Tokyo");
    expect(ist).not.toBeNull();
    expect(tokyo).not.toBeNull();
    // Tokyo (UTC+9) İstanbul'dan (UTC+3) 6 saat ÖNCE gelir.
    expect(ist!.getTime() - tokyo!.getTime()).toBe(6 * 60 * 60 * 1000);
  });

  /**
   * "Saatler dükkanın yerel saatiyle (İstanbul)." metni şehri SABİT yazıyordu.
   * Dilim artık parametre olduğuna göre cümle de parametreli olmalı, yoksa
   * tam da hangi takvimin geçerli olduğunu açıklayan yerde yalan söyler.
   */
  it("saat dilimi ipucu şehri sabit yazmaz", () => {
    for (const loc of ["tr", "en", "de", "fr", "fa", "ja"]) {
      const messages = JSON.parse(
        fs.readFileSync(`src/locales/${loc}.json`, "utf8"),
      );
      expect(messages.Guest.timesInShopTimezone).toContain("{zone}");
    }
  });
});
