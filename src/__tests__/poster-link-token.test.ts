import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SignJWT } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/lib/jwt-audience";
import { POSTER_LINK_TTL_SECONDS, signPosterLinkToken, verifyPosterLinkToken } from "@/lib/poster-link-token";
import { createQrToken, verifyQrToken } from "@/lib/qr-token";
import { authenticateGuestLookup } from "@/lib/guest-lookup-token";

const SECRET = "test-secret-poster-link-0123456789";
const ORIGINAL = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});
afterAll(() => {
  process.env.AUTH_SECRET = ORIGINAL;
});

const key = () => new TextEncoder().encode(SECRET);

describe("oturumsuz afis bagi", () => {
  it("kendi token'ini kabul eder ve 15 dk yasar", async () => {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const { token, expiresAt } = await signPosterLinkToken("shop-1", now);
    expect(await verifyPosterLinkToken(token)).toBe("shop-1");
    expect(Math.round((expiresAt.getTime() - now.getTime()) / 1000)).toBe(POSTER_LINK_TTL_SECONDS);
  });

  it("suresi dolan bag reddedilir", async () => {
    const { token } = await signPosterLinkToken("shop-1", new Date(Date.now() - 16 * 60_000));
    expect(await verifyPosterLinkToken(token)).toBeNull();
  });

  it("baska sirla imzalanan bag reddedilir", async () => {
    const forged = await new SignJWT({ posterShopId: "shop-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE.poster)
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode("baska-sir-baska-sir-baska-sir-00"));
    expect(await verifyPosterLinkToken(forged)).toBeNull();
  });

  it("`aud` tasimayan token afis olarak gecmez", async () => {
    const noAud = await new SignJWT({ posterShopId: "shop-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(JWT_ISSUER)
      .setExpirationTime("10m")
      .sign(key());
    expect(await verifyPosterLinkToken(noAud)).toBeNull();
  });

  it("QR token'i afis bagi olarak gecmez", async () => {
    const qr = await createQrToken({ bookingId: "b1", guestId: "g1", shopId: "shop-1" });
    expect(await verifyPosterLinkToken(qr)).toBeNull();
  });

  it("afis bagi QR ya da misafir sorgu token'i olarak gecmez", async () => {
    const { token } = await signPosterLinkToken("shop-1");
    expect(await verifyQrToken(token)).toBeNull();
    expect((await authenticateGuestLookup(`Bearer ${token}`)).ok).toBe(false);
  });
});
