/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.unmock("@/lib/db");

/*
  Dis dunyaya cikan yan etkiler susturuluyor; olculen sey KIMLIK KAPISI.
  Prisma GERCEK -- bu testin butun degeri, gercek bir veritabani satirina karsi
  gercek uc govdesini kosturmasindan geliyor.
*/
vi.mock("@/services/NotificationService", () => ({
  notificationService: { notifyAdminsForNewUser: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/services/AnalyticsService", () => ({
  analyticsService: { track: vi.fn() },
}));
vi.mock("@/lib/analytics-server", () => ({
  resolveServerSessionId: vi.fn().mockResolvedValue("sess-test"),
}));

import { NextRequest } from "next/server";

/**
 * MOBIL KAYIT UCU PAROLASIZ HESABA TOKEN BASMAZ — entegrasyon kaniti.
 *
 * NEDEN BU TEST VAR (2026-08-31'de bulundu, en agir bulgu): uc, hesap zaten
 * varsa sifreyi YALNIZCA `passwordHash` DOLUYSA dogruluyordu. NULL ise --
 * Google, Apple ya da OTP ile acilmis HER hesapta -- hicbir sey dogrulanmadan
 * access + refresh token basiyordu.
 *
 * Yikici hali: `src/auth.ts` icindeki `ADMIN_EMAILS` listesi Google ile ilk
 * girişte hesabi ADMIN yapiyor ve o hesabin `passwordHash`i null. Yani yonetici
 * e-postasini bilen biri ADMIN rolunde mobil token alip `/api/mobile/admin/*`
 * uclarinin tamamina erisiyordu. Depo acik kaynak: uc adresi de govde semasi da
 * tahmin edilmiyor, okunuyor.
 *
 * Kaynak taramasi (`auth-endpoint-guards`) kalibi tutuyor ama davranisi
 * OLCMUYOR. Bu test gercek uc govdesini gercek bir veritabani satirina karsi
 * kosturuyor: senaryo tam olarak saldirininki.
 *
 * Diger entegrasyon testleriyle ayni kapida: yalnizca CI'da ve DATABASE_URL
 * varken kosar (`admin-stats.integration.test.ts` ile ayni kosul).
 */
const runIntegration = process.env.CI === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runIntegration)("mobil kayit ucu — kimlik dogrulama atlamasi (integration)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let prisma: any;
  let POST: (req: NextRequest) => Promise<Response>;
  const suffix = `regbypass-${Date.now()}`;
  const socialEmail = `sosyal-${suffix}@test.local`;
  const passwordEmail = `parolali-${suffix}@test.local`;
  const createdIds: string[] = [];

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;
    POST = (await import("@/app/api/mobile/auth/register/route")).POST;

    // Google/Apple/OTP ile acilmis hesabin taklidi: passwordHash YOK, rol ADMIN.
    const social = await prisma.user.create({
      data: {
        email: socialEmail,
        name: "Sosyal Admin",
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });
    createdIds.push(social.id);

    const { hashPassword } = await import("@/lib/auth-password");
    const withPassword = await prisma.user.create({
      data: {
        email: passwordEmail,
        name: "Parolali Misafir",
        role: "GUEST",
        passwordHash: await hashPassword("dogru-parola-8"),
      },
    });
    createdIds.push(withPassword.id);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
  });

  function request(body: unknown, ip: string) {
    return new NextRequest("https://ornek.test/api/mobile/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify(body),
    });
  }

  it("PAROLASIZ mevcut hesap: token BASMAZ, 409 doner", async () => {
    const res = await POST(
      request({ email: socialEmail, password: "saldirganin-uydurdugu" }, "203.0.113.10"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("account_exists_social");
    expect(
      body.accessToken,
      "PAROLASIZ hesaba token basmak, e-postayi bilen herkese o hesabi vermek demek",
    ).toBeUndefined();
    expect(body.refreshToken).toBeUndefined();
  });

  it("parolasiz hesabin ROLU token uretimine hic ulasmiyor (ADMIN devralma yolu)", async () => {
    const res = await POST(
      request({ email: socialEmail, password: "x".repeat(12) }, "203.0.113.11"),
    );
    const raw = await res.text();
    expect(res.status).toBe(409);
    expect(raw).not.toContain("accessToken");
    expect(raw, "rol bilgisi de sizmamali").not.toContain("ADMIN");
  });

  it("gonderilen parola hesaba YAZILMIYOR (sessiz ele gecirme yok)", async () => {
    /*
      Eski davranista gonderilen parola hicbir yere yazilmiyordu ama token
      veriliyordu. Yeni davranista da yazilmamali: bu uc parolasiz bir hesaba
      parola BELIRLEYEMEZ -- o is, e-posta sahipligini kanitlayan sifirlama
      akisinin.
    */
    await POST(request({ email: socialEmail, password: "yeni-parola-123" }, "203.0.113.12"));
    const after = await prisma.user.findUnique({ where: { email: socialEmail } });
    expect(after.passwordHash).toBeNull();
  });

  it("PAROLALI mevcut hesap: dogru parolayla token verilir", async () => {
    const res = await POST(
      request({ email: passwordEmail, password: "dogru-parola-8" }, "203.0.113.13"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("PAROLALI mevcut hesap: yanlis parolayla 401", async () => {
    const res = await POST(
      request({ email: passwordEmail, password: "yanlis-parola-9" }, "203.0.113.14"),
    );
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe("invalid_credentials");
    expect(body.accessToken).toBeUndefined();
  });
});
