import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SignJWT } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/lib/jwt-audience";
import { authenticateGuestLookup, signGuestLookupToken } from "@/lib/guest-lookup-token";
import { createQrToken, verifyQrToken } from "@/lib/qr-token";
import { verifyMobileToken } from "@/lib/mobile-auth";

/**
 * TOKEN AILELERI ARASINDAKI SINIR.
 *
 * NEDEN VAR (2026-08-31'de olculdu): projede HS256 ile imzalanan uc ayri token
 * ailesi AYNI sirri (`AUTH_SECRET`) kullaniyor — mobil oturum, QR/muhur ve
 * misafir sorgu. Ayni sirla imzalanan token'lari imza AYIRT ETMEZ; ayrimi
 * yalnizca dogrulayan tarafin alan kontrolleri yapiyordu ve o kontroller
 * "gerekli alan var mi" sorusuna bakiyordu, "yabanci alan var mi" sorusuna
 * degil.
 *
 * Bugun uc govde birbirinin gerektirdigi alanlari tasimiyor, yani somut bir
 * gecis yok. Ama bu bir TESADUF, bir tasarim degil: QR token'i misafirin
 * ELINDE ve ekraninda duruyor; ona bir gun `email` alani eklenirse
 * `guest-cancel` onu kabul eder ve rezervasyon iptaline yeter. Depo acik
 * kaynak — saldirgan bu semalari tahmin etmiyor, okuyor.
 *
 * Bu dosya o tesadufu SOZLESMEYE cevirir: her dogrulayici, digerinin
 * govdesini reddetmek ZORUNDA.
 */

const SECRET = "test-secret-for-jwt-family-boundary-0123456789";
const ORIGINAL_AUTH = process.env.AUTH_SECRET;
const ORIGINAL_MOBILE = process.env.MOBILE_JWT_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
  // Mobil sir AYRICA tanimliysa cakisma zaten yok; bu test ORTAK sir halini olcer.
  delete process.env.MOBILE_JWT_SECRET;
});

afterAll(() => {
  if (ORIGINAL_AUTH === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL_AUTH;
  if (ORIGINAL_MOBILE === undefined) delete process.env.MOBILE_JWT_SECRET;
  else process.env.MOBILE_JWT_SECRET = ORIGINAL_MOBILE;
});

const key = () => new TextEncoder().encode(SECRET);

/** Ayni sirla, istenen govdeyle, gecerli imzali bir token uretir. */
async function forge(payload: Record<string, unknown>, aud?: string) {
  let b = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime("1h");
  if (aud) b = b.setAudience(aud);
  return b.sign(key());
}

describe("token aileleri birbirinin kapisini acmaz", () => {
  it("kendi ailesinin token'ini kabul eder (temel dogruluk)", async () => {
    const guest = await signGuestLookupToken({ bookingId: "b1", email: "a@b.co" });
    const result = await authenticateGuestLookup(`Bearer ${guest}`);
    expect(result.ok).toBe(true);

    const qr = await createQrToken({ bookingId: "b1", guestId: "g1", shopId: "s1" });
    expect(await verifyQrToken(qr)).toEqual({
      bookingId: "b1",
      guestId: "g1",
      shopId: "s1",
    });
  });

  it("QR token'i misafir sorgu ucunda gecmez", async () => {
    const qr = await createQrToken({ bookingId: "b1", guestId: "g1", shopId: "s1" });
    const result = await authenticateGuestLookup(`Bearer ${qr}`);
    expect(result.ok).toBe(false);
  });

  it("`email` EKLENMIS bir QR token'i bile misafir sorgu ucunda gecmez", async () => {
    /*
      Asil sinav bu: gecerli imza, gecerli sure, `bookingId` VE `email` var.
      Alan varligina bakan eski dogrulama bunu KABUL EDERDI. `aud` ve yabanci
      alan (`guestId`/`shopId`) kontrolu reddediyor.
    */
    const forged = await forge(
      { bookingId: "b1", guestId: "g1", shopId: "s1", email: "kurban@ornek.com" },
      JWT_AUDIENCE.qr,
    );
    const result = await authenticateGuestLookup(`Bearer ${forged}`);
    expect(result.ok).toBe(false);
  });

  it("misafir sorgu token'i QR olarak gecmez", async () => {
    const guest = await signGuestLookupToken({ bookingId: "b1", email: "a@b.co" });
    expect(await verifyQrToken(guest)).toBeNull();
  });

  it("misafir sorgu token'i mobil oturum olarak gecmez", async () => {
    const guest = await signGuestLookupToken({ bookingId: "b1", email: "a@b.co" });
    await expect(verifyMobileToken(guest)).rejects.toThrow();
  });

  it("mobil oturum token'i misafir sorgu ucunda gecmez", async () => {
    const mobile = await forge(
      { sub: "u1", role: "GUEST", type: "access", tv: 0 },
      JWT_AUDIENCE.mobile,
    );
    const result = await authenticateGuestLookup(`Bearer ${mobile}`);
    expect(result.ok).toBe(false);
  });

  it("baska ailenin `aud`'unu tasiyan token reddedilir", async () => {
    const wrongAud = await forge({ bookingId: "b1", email: "a@b.co" }, JWT_AUDIENCE.mobile);
    const result = await authenticateGuestLookup(`Bearer ${wrongAud}`);
    expect(result.ok).toBe(false);
  });

  it("`aud` TASIMAYAN eski token hâlâ gecer (gecis donemi)", async () => {
    /*
      QR token'lari veritabaninda (`Booking.qrCodeToken`), misafirin
      e-postasinda ve ekraninda duruyor; omru check-out + 24 saat. `aud`'u
      bugun ZORUNLU kilmak, o an ACIK olan rezervasyonlarin QR'larini
      calismaz hale getirirdi. Yabanci-alan kontrolu o boslugu kapatiyor.
      Yayindaki en uzun omurlu QR dustukten sonra bu test tersine cevrilebilir.
    */
    const legacy = await forge({ bookingId: "b1", email: "a@b.co" });
    const result = await authenticateGuestLookup(`Bearer ${legacy}`);
    expect(result.ok).toBe(true);
  });

  it("mobil oturum token'i `sub` tasimak ZORUNDA", async () => {
    const noSub = await forge({ role: "ADMIN", type: "access", tv: 0 }, JWT_AUDIENCE.mobile);
    await expect(verifyMobileToken(noSub)).rejects.toThrow();
  });
});
