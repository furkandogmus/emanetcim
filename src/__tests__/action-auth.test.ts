import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * YETKİ KAPISI — tek yer, tek konvansiyon.
 *
 * NEDEN (2026-08-25'te ölçüldü): aynı üç kontrol 12 dosyada ~28 kez elle
 * yazılmıştı ve kopyalar BEŞ farklı başarısızlık konvansiyonu kullanıyordu:
 * `throw new Error("Unauthorized")` (8 yerde), `"Errors.authRequired"`,
 * `"Errors.unauthorized"`, `"Errors.notAuthorizedAdmin"`, ve snake_case
 * `"unauthorized"`. Kullanıcı açısından sonucu şuydu: **aynı "yetkiniz yok"
 * durumu, hangi dosyaya denk geldiğine göre dört farklı mesaj üretiyordu.**
 *
 * Ham `"Unauthorized"` ayrıca `actionErrorKey`'in tanıdığı bir anahtar DEĞİLDİ,
 * yani `generic`e düşüyor ve yönetici sebebi söyleyebilecekken "Bilinmeyen bir
 * hata oluştu" okuyordu.
 */

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockAuth }));

import {
  requireUser,
  requireAdmin,
  requirePartner,
  assertAdmin,
  assertPartner,
} from "@/lib/action-auth";
import { actionErrorKey } from "@/lib/action-error";

beforeEach(() => vi.clearAllMocks());

describe("yetki kapısı", () => {
  it("giriş yapmamış kullanıcıya GİRİŞ YAPIN der", async () => {
    for (const session of [null, undefined, {}, { user: {} }, { user: { role: "ADMIN" } }]) {
      mockAuth.mockResolvedValue(session);
      // `id` yoksa oturum yok sayilir; rol tek basina yetmez.
      expect(await requireAdmin(), JSON.stringify(session)).toEqual({
        ok: false,
        error: "Errors.authRequired",
      });
    }
  });

  it("giriş yapmış ama YETKİSİZ kullanıcıya neyin eksik olduğunu söyler", async () => {
    // Bu ayrimin sebebi: yetkisiz bir kullaniciya "giris yapin" demek yanlis
    // yonlendirmedir — zaten girmistir.
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST" } });
    expect(await requireAdmin()).toEqual({ ok: false, error: "Errors.notAuthorizedAdmin" });
    expect(await requirePartner()).toEqual({ ok: false, error: "Errors.notAuthorizedPartner" });
  });

  it("esnaf işlemlerini admin de yapabilir", async () => {
    for (const role of ["PARTNER", "ADMIN"]) {
      mockAuth.mockResolvedValue({ user: { id: "u1", role } });
      expect(await requirePartner(), role).toEqual({ ok: true, actor: { id: "u1", role } });
    }
  });

  it("admin kapısından esnaf geçemez", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "PARTNER" } });
    expect(await requireAdmin()).toEqual({ ok: false, error: "Errors.notAuthorizedAdmin" });
  });

  it("`requireUser` rol farketmeksizin geçirir", async () => {
    for (const role of ["GUEST", "PARTNER", "ADMIN"]) {
      mockAuth.mockResolvedValue({ user: { id: "u1", role } });
      expect((await requireUser()).ok, role).toBe(true);
    }
  });

  it("fırlatan biçim TANINAN anahtarla fırlatır — `generic`e düşmez", async () => {
    // Asil kusur buydu: ham `"Unauthorized"` metni `actionErrorKey` tarafindan
    // taninmiyor ve kullaniciya "bilinmeyen hata" olarak gidiyordu.
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "GUEST" } });

    await expect(assertAdmin()).rejects.toThrow("Errors.notAuthorizedAdmin");
    await expect(assertPartner()).rejects.toThrow("Errors.notAuthorizedPartner");

    const caught = await assertAdmin().catch((e) => e);
    expect(actionErrorKey(caught)).toBe("notAuthorizedAdmin");
    expect(actionErrorKey(caught)).not.toBe("generic");
  });

  it("başarıda aktörü döndürür — çağıran `session` çözmek zorunda kalmaz", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-9", role: "ADMIN" } });
    expect(await assertAdmin()).toEqual({ id: "admin-9", role: "ADMIN" });
  });
});

describe("mandal: yetki kontrolü elle yazılmıyor", () => {
  function actionFiles(): string[] {
    const dir = path.join(process.cwd(), "src/actions");
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(dir, f));
  }

  it("hiçbir action ham `Unauthorized` fırlatmıyor", () => {
    const offenders = actionFiles()
      .filter((f) => /throw new Error\(["']Unauthorized["']\)/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.basename(f));
    expect(
      offenders,
      "Ham `Unauthorized` `actionErrorKey` tarafından tanınmaz ve kullanıcıya " +
        "'bilinmeyen hata' olarak gider. `assertAdmin()` / `assertPartner()` kullanın:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("hiçbir action rolü OTURUMDAN kendi çözmüyor", () => {
    /*
      Ayrim onemli:
        - `session.user.role !== "ADMIN"`  -> YASAK. Bu, kapinin kopyasidir.
        - `auth.actor.role !== "ADMIN"`    -> SERBEST. Aktor kapidan gelmistir ve
          bu bir ALAN kuralidir ("admin sahiplik kontrolunu atlar").
      Ikisini ayirmayan bir mandal, mesru sahiplik kurallarini da bastirir ve
      ya gereksiz refactor'a ya da kapatilmaya yol acar.
    */
    const re = /session[?.]*\.user[?.]*\.role\s*!==/;
    const offenders = actionFiles()
      .filter((f) => re.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.basename(f));
    expect(
      offenders,
      "Rol kapısı `src/lib/action-auth.ts`'te. Bu dosyalar kendi kopyasını yazıyor:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("mandal: esnaf SAYFALARI da kapıyı kullanıyor", () => {
  /*
    NEDEN AYRI BIR MANDAL (2026-08-31'de olculdu): yukaridaki mandal yalnizca
    `src/actions/` tariyor. Sayfalar hic kapsanmamisti ve esnaf panelinin bes
    sayfasi kontrolu elle yaziyordu -- ustelik UC AYRI davranisla:

      - `partner/page.tsx`, `earnings`, `seals` -> yetkisizi /login'e atiyordu
      - `partner/settings`                      -> sessizce /${locale}'e atiyordu
      - `partner/bookings`                      -> satir ici "erisim yok" karti
                                                   cizip role gore /bookings'e

    Giris YAPMIS bir misafir icin ilk davranis SONSUZ DONGU uretiyordu: /login'e
    gidiyor, zaten girisli oldugu icin callbackUrl'e geri donuyor, yine
    atiliyordu. Kural artik `src/lib/page-auth.ts`'te.
  */
  const PARTNER_PAGE_DIR = "src/app/[locale]/partner";

  function partnerPageFiles(): string[] {
    const root = path.join(process.cwd(), PARTNER_PAGE_DIR);
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "page.tsx") out.push(full);
      }
    };
    walk(root);
    return out;
  }

  it("hiçbir esnaf sayfası rolü OTURUMDAN kendi çözmüyor", () => {
    const re = /session[?.]*\.user[?.]*\.role|\brole\s*!==\s*["'](?:PARTNER|ADMIN)["']/;
    const offenders = partnerPageFiles()
      .filter((f) => re.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(process.cwd(), f));
    expect(
      offenders,
      "Sayfa yetki kapısı `src/lib/page-auth.ts`'te (`requirePartnerPage`). " +
        "Bu sayfalar kendi kopyasını yazıyor:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("her esnaf sayfası `requirePartnerPage` çağırıyor", () => {
    // Kopyayi yasaklamak yetmez: kapiyi HIC cagirmayan bir sayfa da gecerdi.
    const offenders = partnerPageFiles()
      .filter((f) => !/requirePartnerPage\(/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(process.cwd(), f));
    expect(
      offenders,
      "Bu esnaf sayfaları hiçbir yetki kapısından geçmiyor:\n" + offenders.join("\n"),
    ).toEqual([]);
  });
});
