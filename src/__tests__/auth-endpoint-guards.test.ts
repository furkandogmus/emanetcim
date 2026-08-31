import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * KIMLIK DOGRULAMA UCLARININ KAPILARI — kaynak taramasi.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `/api/mobile/auth/*` altindaki uclarin
 * uctan uca testi yok (Playwright akislari giris SONRASINI oluyor), yani bu
 * uclardaki bir gerileme HICBIR SEY tarafindan yakalanmiyordu. Bu dosyanin
 * yakaladigi somut hatalar:
 *
 *   1. **`register` kimlik dogrulamayi ATLIYORDU.** Hesap varsa ve
 *      `passwordHash` NULL ise (Google / Apple / OTP ile acilmis her hesap)
 *      hicbir sey dogrulanmadan access + refresh token basiliyordu. Bir
 *      e-postayi bilen herkes o hesabin mobil oturumunu aliyordu; `ADMIN_EMAILS`
 *      listesindeki bir Google hesabi ADMIN rolunde. Depo acik kaynak: uc
 *      adresi ve govde semasi zaten okunabilir durumda.
 *   2. **Hiz sinirlari SABIT anahtar kullaniyordu** (`mobile_google_auth`,
 *      `mobile_apple_auth`, `register`): tek bir kova tum dunyayi sayiyordu,
 *      yani dakikada on istek atan biri sosyal girisi HERKES icin kapatiyordu.
 *      Hiz siniri degil, bedava hizmet disi birakma dugmesi.
 *   3. **Bes uc hic sinir tasimiyordu** — sifre sifirlama onayi, token
 *      yenileme, e-posta dogrulama ve iki misafir sorgu ucu.
 *
 * Kaynak taramasi, agir bir HTTP kosum takimi kurmadan bu uc kurali da
 * sabitliyor. Kirilirsa neden kirildigi mesajda yaziyor.
 */

const ROOT = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Hiz siniri TASIMASI ZORUNLU uclar ve neden. */
const MUST_RATE_LIMIT: Array<{ file: string; why: string }> = [
  {
    file: "src/app/api/mobile/auth/register/route.ts",
    why: "hesap acar ve token uretir",
  },
  {
    file: "src/app/api/mobile/auth/session/route.ts",
    why: "sifre ve OTP dogrular",
  },
  {
    file: "src/app/api/mobile/auth/refresh/route.ts",
    why: "token uretir",
  },
  {
    file: "src/app/api/mobile/auth/verify-email/route.ts",
    why: "token tuketir",
  },
  {
    file: "src/app/api/mobile/auth/password-reset/confirm/route.ts",
    why: "sifre yazar — hesap devralmaya en yakin uc",
  },
  {
    file: "src/app/api/mobile/auth/google/route.ts",
    why: "kimlik dogrular ve token uretir",
  },
  {
    file: "src/app/api/mobile/auth/apple/route.ts",
    why: "kimlik dogrular ve token uretir",
  },
  {
    file: "src/app/api/bookings/lookup/route.ts",
    why: "kimliksiz cagrilir ve iptale yeten bir tasiyici token uretir",
  },
  {
    file: "src/app/api/bookings/lookup/me/route.ts",
    why: "misafirin QR token'ini dondurur",
  },
  {
    file: "src/app/api/bookings/guest-cancel/route.ts",
    why: "rezervasyon iptal eder",
  },
];

describe("kimlik dogrulama uclarinin kapilari", () => {
  it.each(MUST_RATE_LIMIT)("$file hiz siniri tasir ($why)", ({ file }) => {
    const src = read(file);
    expect(src).toMatch(/rateLimit\(/);
  });

  it("hicbir kimlik ucu SABIT hiz siniri anahtari kullanmaz", () => {
    /*
      Sabit anahtar = tek kova = tum kullanicilar ayni sayacta. Bir saldirgan
      kovayi doldurunca GERCEK kullanicilar 429 alir. Anahtar en az bir
      degisken (IP ya da kimlik) tasimali — sablon dizesi bunu gorunur kilar.
    */
    const offenders: string[] = [];
    for (const { file } of MUST_RATE_LIMIT) {
      const src = read(file);
      for (const m of src.matchAll(/rateLimit\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g)) {
        const key = m[1];
        const hasVariable = key.startsWith("`") && key.includes("${");
        if (!hasVariable) offenders.push(`${file}: ${key}`);
      }
    }
    expect(
      offenders,
      "Sabit hiz siniri anahtari bulundu. Tek kova tum kullanicilari sayar ve " +
        "saldirgan onu doldurunca gercek kullanicilar disarida kalir:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("register: parolasiz mevcut hesaba token BASMAZ", () => {
    const src = read("src/app/api/mobile/auth/register/route.ts");
    /*
      Onceki hali: `if (existing.passwordHash) { ...dogrula... }` — yani
      `passwordHash` NULL ise dogrulama BLOGU HIC calismiyor ve alt satirda
      token uretiliyordu. Dogrusu erken cikis: parolasiz hesapta bu uc token
      uretmez, cunku kimligi kanitlayan hicbir sey yok.
    */
    expect(src).toMatch(/if\s*\(\s*!existing\.passwordHash\s*\)/);
    expect(src).toMatch(/account_exists_social/);
    expect(
      src,
      "Sifre dogrulamasi `passwordHash` VARSA calisan bir blogun icinde " +
        "olmamali: null oldugunda blok atlanip token uretiliyordu.",
    ).not.toMatch(/if\s*\(\s*existing\.passwordHash\s*\)\s*\{/);
  });

  it("apple: dogrulanmamis e-postayi kimlik olarak kullanmaz", () => {
    /*
      Apple `sub` bilinmiyorken token'daki e-posta MEVCUT bir hesaba denk
      gelirse Apple kimligi o hesaba baglaniyor. Dogrulanmamis bir e-postayla
      acilmis Apple ID, o adrese ait hesabi devralmaya yetiyordu. Google ucu
      `email_verified`i bastan beri kontrol ediyordu, Apple ucu etmiyordu.
    */
    const src = read("src/app/api/mobile/auth/apple/route.ts");
    expect(src).toMatch(/email_verified/);
  });

  it("cikis mobil token'lari GERCEKTEN iptal eder", () => {
    /*
      Onceki hali yalnizca `prisma.session.deleteMany` cagiriyordu — o tablo
      web adapter'ina ait. Mobil kimlik durumsuz JWT; iptalin tek yolu
      `tokenVersion`. Yani cikis dugmesi mobilde hicbir sey yapmiyor, refresh
      token 30 GUN daha gecerli kaliyordu.
    */
    const src = read("src/app/api/mobile/auth/logout/route.ts");
    expect(src).toMatch(/revokeAllUserSessions/);
    const service = read("src/services/auth/mobile-session.ts");
    expect(service).toMatch(/tokenVersion:\s*\{\s*increment:\s*1\s*\}/);
  });

  it("sifre sifirlama iki tasiyicida da AYNI govdeyi cagirir", () => {
    /*
      Kopyalar ayrismisti: web `tokenVersion`i artirmiyordu (sifre degisse bile
      calinmis mobil oturum 30 gun daha yasiyordu), alt sinir bir tarafta 8
      digerinde 6'ydi, telefonla sifirlama yalnizca web'de calisiyordu.
    */
    const web = read("src/actions/password-reset.ts");
    const mobile = read("src/app/api/mobile/auth/password-reset/confirm/route.ts");
    expect(web).toMatch(/consumePasswordResetToken/);
    expect(mobile).toMatch(/consumePasswordResetToken/);
    const service = read("src/services/auth/password-reset.ts");
    expect(service).toMatch(/tokenVersion:\s*\{\s*increment:\s*1\s*\}/);
  });

  it("ic uclarin hepsi ORTAK cron kapisini kullanir", () => {
    /*
      `internal-api-guard.ts` tam da bunun icin yazilmisti ama uc dosya kendi
      kopyasinda kalmisti ve o kopyalar `bearer === secret` — sabit zamanli
      olmayan bir karsilastirma — kullaniyordu.
    */
    const dir = path.join(ROOT, "src/app/api/internal");
    const routes = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join("src/app/api/internal", e.name, "route.ts"))
      .filter((rel) => fs.existsSync(path.join(ROOT, rel)));

    expect(routes.length).toBeGreaterThan(0);
    const missing = routes.filter((rel) => !read(rel).includes("authorizeCron"));
    expect(
      missing,
      "Ic uc kendi CRON_SECRET karsilastirmasini yaziyor. `authorizeCron` " +
        "sabit zamanli karsilastirma yapiyor ve kural tek yerde duruyor:\n" +
        missing.join("\n"),
    ).toEqual([]);
  });

  it("requireMobileUser tum User satirini CEKMEZ", () => {
    /*
      Onceki hali `findUnique`i `select` OLMADAN cagiriyordu: her yetkili mobil
      istek butun `User` satirini cekiyordu. `image` sutunu bir base64 data URL
      (avatar 2 MB'a kadar, base64 ile ~2,7 MB), yani avatar yuklemis bir
      kullanicinin HER istegi hicbir ucun okumadigi megabaytlarca metni
      Postgres'ten aliyordu. `passwordHash` de istek nesnesine giriyordu.
    */
    const src = read("src/lib/mobile-auth.ts");
    const call = src.match(/requireMobileUser[\s\S]*?findUnique\(\{[\s\S]*?\}\)/);
    expect(call, "requireMobileUser icinde findUnique bulunamadi").not.toBeNull();
    expect(
      call![0],
      "requireMobileUser `select` kullanmali: `select`siz sorgu `image` " +
        "(base64 avatar, MB'lar) ve `passwordHash` dahil butun satiri ceker.",
    ).toMatch(/select:\s*\{/);
    expect(call![0]).not.toMatch(/passwordHash/);
  });

  it("profil guncelleme telefonu NORMALIZE ederek yazar", () => {
    /*
      Giris ve OTP yollari numarayi on haneye indirip uc bicimi birden ariyor
      (`5xx`, `+905xx`, `05xx`) ve bunu SIRALAMASIZ `findFirst` ile yapiyor.
      Ham deger yazilabildigi surece ayni numaranin iki bicimi iki AYRI satirda
      durabilir (`@unique` farkli dizeleri engellemez) ve girisin hangi satiri
      buldugu belirsiz olur.
    */
    const src = read("src/app/api/mobile/auth/me/route.ts");
    expect(src).toMatch(/normalizeTrGsm10/);
    expect(src).toMatch(/invalid_phone/);
  });

  it("Auth.js ayiklama kipi uretimde kapali", () => {
    /*
      `debug: true` SABITTI. Auth.js ayiklama kipinde saglayici yanitlarini,
      `state` / `code_verifier` degerlerini ve callback parametrelerini sunucu
      ciktisina yazar — yani oturum acma akisinin sirlarini log'a doker.
    */
    const src = read("src/auth.ts");
    expect(src).not.toMatch(/debug:\s*true/);
    expect(src).toMatch(/debug:\s*process\.env\.NODE_ENV\s*!==\s*"production"/);
  });
});
