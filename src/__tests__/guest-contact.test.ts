import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bookingNotificationEmail } from "@/services/booking/guest-contact";

/**
 * Bildirim ALICISI — web ve mobilin ayri ayri, YARIM yazdigi kural.
 *
 * 2026-08-25'te olculdu: web `booking.guest?.email`e, mobil `booking.guestEmail`e
 * bakiyordu. Rezervasyon ya hesapli (`guest.email`) ya hesapsiz misafir
 * checkout'udur (`guestEmail`); ikisi ayni anda dolu degildir. Yani web'den
 * check-in yapildiginda HESAPSIZ misafir, mobilden yapildiginda HESAPLI misafir
 * e-posta ALMIYORDU. Her iki yol da musterilerinin yarisini sessizce atliyordu.
 */
describe("bookingNotificationEmail", () => {
  it("hesaplı misafirin adresini bulur", () => {
    expect(
      bookingNotificationEmail({ guestEmail: null, guest: { email: "uye@ornek.com" } }),
    ).toBe("uye@ornek.com");
  });

  it("hesapsız misafir checkout'unun adresini bulur", () => {
    expect(bookingNotificationEmail({ guestEmail: "misafir@ornek.com", guest: null })).toBe(
      "misafir@ornek.com",
    );
  });

  it("ikisi de doluysa HESAP adresi kazanır", () => {
    // Hesapli kullanici e-postasini degistirdiginde guncel adres orasidir;
    // `guestEmail` rezervasyon anindaki fotografitir.
    expect(
      bookingNotificationEmail({
        guestEmail: "eski@ornek.com",
        guest: { email: "yeni@ornek.com" },
      }),
    ).toBe("yeni@ornek.com");
  });

  it("adres yoksa ya da yer tutucuysa `null` döner", () => {
    expect(bookingNotificationEmail({ guestEmail: null, guest: null })).toBeNull();
    expect(bookingNotificationEmail({})).toBeNull();
    expect(bookingNotificationEmail({ guestEmail: "" })).toBeNull();
    // "@" tasimayan yer tutucular (telefonla rezervasyon) alici degildir.
    expect(bookingNotificationEmail({ guestEmail: "05551112233" })).toBeNull();
  });
});

describe("alıcı kuralı tek yerde", () => {
  const ROOTS = ["src/actions", "src/app"];

  function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
  }

  it("hiçbir taşıyıcı kendi alıcı kuralını yazmıyor", () => {
    // `booking.guestEmail` / `booking.guest?.email` uzerinden DOGRUDAN bildirim
    // gondermek, tam olarak ayrisan davranisi geri getirir.
    const re =
      /notify(?:CheckIn|CheckOut|BookingSuccess|BookingApproved|BookingCancelled)\(\s*booking\.(?:guestEmail|guest)/;
    const offenders = ROOTS.flatMap((r) => walk(path.join(process.cwd(), r)))
      .filter((f) => re.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(process.cwd(), f));

    expect(
      offenders,
      "Bu dosyalar alıcıyı kendisi seçiyor. `bookingNotificationEmail(booking)` kullanın:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
