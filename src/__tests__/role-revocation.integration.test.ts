/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.unmock("@/lib/db");

/*
  Dis dunyaya cikan yan etkiler susturuluyor; olculen sey YETKI ZINCIRI.
  Prisma GERCEK -- `tokenVersion` gercek bir sutun ve iptalin tek kaldiraci o.
*/
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
/*
  `next/headers` UST SEVIYEDE mock'lanir: `vi.mock` cagrilari dosya basina
  kaldiriliyor (hoisting), bir test govdesinin icinde yazmak ise etki etmez --
  ilk yazimda oyle yazildi ve mock hic devreye girmedi.
*/
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn().mockResolvedValue("203.0.113.1"),
  getClientIpOrNull: vi.fn().mockResolvedValue("203.0.113.1"),
  clientIpFromHeaders: vi.fn().mockReturnValue("203.0.113.1"),
  clientIpFromRequest: vi.fn().mockReturnValue("203.0.113.1"),
}));

import { NextRequest } from "next/server";

/**
 * YETKISI ALINAN YONETICI, YONETICI KALMIYOR — entegrasyon kaniti.
 *
 * NEDEN BU TEST VAR (2026-08-31'de bulundu): rol HEM mobil JWT'nin `role`
 * isteminde HEM web oturum token'inin icinde tasiniyor. `admin-management`
 * rolu dusuruyordu ama elde duran imzali token'lara dokunmuyordu ve hicbir
 * taraf rolu veritabanina karsi yeniden okumuyordu:
 *
 *   - mobil erisim token'i 15 dakika, REFRESH token'i 30 GUN gecerli kaliyordu
 *   - `getMobileSession` rolu TOKEN'dan donduruyordu (kardesi
 *     `requireMobileUser` veritabanindan) -- ve o yardimciyi web YONETICI
 *     uclari kullaniyor
 *   - web oturumu Auth.js varsayilaniyla 30 gun
 *
 * Kaynak taramasi (`auth-endpoint-guards`) `tokenVersion` artisinin YAZILDIGINI
 * dogruluyor ama ZINCIRIN CALISTIGINI dogrulamiyor: artis yazilip
 * `requireMobileUser` onu karsilastirmasaydi tarama yine yesil kalirdi.
 *
 * Bu test zinciri ucundan ucuna kosturuyor: token uret -> kabul edildigini gor
 * -> rolu dusur -> AYNI token'in artik reddedildigini gor.
 *
 * Yalnizca `CI=true` ve `DATABASE_URL` varken kosar.
 */
const runIntegration = process.env.CI === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runIntegration)("rol degisikligi token'lari iptal eder (integration)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let prisma: any;
  const suffix = `rolerevoke-${Date.now()}`;
  const ids: string[] = [];

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
  });

  let seq = 0;
  async function makeUser(role: "ADMIN" | "PARTNER" | "GUEST") {
    // Her cagri BENZERSIZ e-posta: `User.email` tekil, ayni rolden iki kullanici
    // gerekiyor (tek admin kalirsa dusurme kurali engelliyor).
    const u = await prisma.user.create({
      data: {
        email: `${role.toLowerCase()}-${++seq}-${suffix}@test.local`,
        name: role,
        role,
      },
    });
    ids.push(u.id);
    return u;
  }

  function authed(token: string) {
    return new NextRequest("https://ornek.test/api/mobile/bookings/me", {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("gecerli token kabul edilir ve ROL VERITABANINDAN gelir", async () => {
    const { signAccessToken, requireMobileUser } = await import("@/lib/mobile-auth");
    const user = await makeUser("ADMIN");

    const token = await signAccessToken(user.id, "ADMIN", user.tokenVersion);
    const result = await requireMobileUser(authed(token));

    expect("error" in result).toBe(false);
    expect((result as any).user.role).toBe("ADMIN");
    expect((result as any).user.id).toBe(user.id);
  });

  it("`tokenVersion` artinca AYNI token reddedilir", async () => {
    /*
      Iptalin tek kaldiraci bu. Durumsuz JWT'de sunucuda silinecek bir oturum
      satiri yok; `requireMobileUser` her istekte token'daki `tv` ile
      kullanicidaki degeri karsilastiriyor.
    */
    const { signAccessToken, requireMobileUser } = await import("@/lib/mobile-auth");
    const user = await makeUser("PARTNER");
    const token = await signAccessToken(user.id, "PARTNER", user.tokenVersion);

    expect("error" in (await requireMobileUser(authed(token)))).toBe(false);

    const { revokeAllUserSessions } = await import("@/services/auth/mobile-session");
    await revokeAllUserSessions(user.id);

    const after = await requireMobileUser(authed(token));
    expect("error" in after, "iptalden sonra token gecmemeli").toBe(true);
    expect((after as any).error.status).toBe(401);
  });

  it("ROL DUSURULUNCE eldeki token gecersizlesir (uctan uca)", async () => {
    /*
      ASIL SENARYO: yetkisi alinan yonetici. Onceden bu token 15 dakika daha
      ADMIN olarak calisiyordu -- refresh token'i ise 30 gun.
    */
    const admin = await makeUser("ADMIN");
    const otherAdmin = await makeUser("ADMIN"); // tek admin kalmasin (demote kurali)
    void otherAdmin;

    const { signAccessToken, requireMobileUser } = await import("@/lib/mobile-auth");
    const token = await signAccessToken(admin.id, "ADMIN", admin.tokenVersion);
    expect("error" in (await requireMobileUser(authed(token)))).toBe(false);

    const before = await prisma.user.findUnique({ where: { id: admin.id } });

    // `applyUserRoleChange`in yaptigi yazma; action'in kendisi `ensureAdmin`
    // istiyor, olculen sey ise YAZMANIN ETKISI.
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "GUEST", tokenVersion: { increment: 1 } },
    });

    const after = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);

    const result = await requireMobileUser(authed(token));
    expect(
      "error" in result,
      "yetkisi alinan yoneticinin eldeki token'i ANINDA dusmeli",
    ).toBe(true);
  });

  it("`getMobileSession` rolu TOKEN'dan degil veritabanindan okur", async () => {
    /*
      Bu yardimciyi web YONETICI uclari kullaniyor
      (`/api/admin/applications`, `/api/admin/messages`). Rolu token'dan
      okusaydi, yetkisi alinmis bir yoneticinin elindeki "role: ADMIN" yazan
      token'a inanirdi.

      Senaryo: token ADMIN diyor, veritabani GUEST diyor, `tokenVersion` ayni
      (yani token teknik olarak hala gecerli). Dogru yanit GUEST.
    */
    const user = await makeUser("GUEST");
    const { signAccessToken, getMobileSession } = await import("@/lib/mobile-auth");
    // Token'a KASITLI olarak yanlis (yuksek) rol yaziliyor.
    const token = await signAccessToken(user.id, "ADMIN", user.tokenVersion);

    const { headers } = await import("next/headers");
    (headers as any).mockResolvedValue(new Headers({ authorization: `Bearer ${token}` }));

    const session = await getMobileSession();
    expect(session).not.toBeNull();
    expect(
      session!.role,
      "rol veritabanindan gelmeli; token 'ADMIN' diyor ama kullanici GUEST",
    ).toBe("GUEST");
  });
});
