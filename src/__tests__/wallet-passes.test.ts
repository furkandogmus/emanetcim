import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import { createRequire } from "node:module";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

/** Wallet kartlari: icerik, token, erisim ve yapilandirilmamisken kapali kalma. */
const { mockPrisma, mockRequireMobileUser, mockRateLimit } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { findUnique: vi.fn() },
    walletPassDevice: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  },
  mockRequireMobileUser: vi.fn(),
  mockRateLimit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));

import { decodePem, readAppleWalletConfig, walletCapabilities, APPLE_WALLET_ENV, GOOGLE_WALLET_ENV } from "@/lib/wallet/config";
import {
  passAuthenticationToken,
  signWalletLinkToken,
  verifyPassAuthorization,
  verifyWalletLinkToken,
} from "@/lib/wallet/link-token";
import {
  buildApplePassJson,
  buildGoogleGenericObject,
  googleObjectId,
  walletPassContent,
  type WalletBookingSource,
} from "@/lib/wallet/pass-content";
import { createQrToken } from "@/lib/qr-token";
import { signPosterLinkToken } from "@/lib/poster-link-token";
import { toMobileAppConfig } from "@/lib/mobile-dto";
import { renderEmailHtml } from "@/lib/email-template";
import { WalletPassService } from "@/services/WalletPassService";
import { GET as appleLinkGET } from "@/app/api/wallet/apple/route";
import { GET as googleLinkGET } from "@/app/api/wallet/google/route";
import { GET as mobileWalletGET } from "@/app/api/mobile/bookings/[id]/wallet/route";
import { POST as registerPOST, DELETE as registerDELETE } from "@/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route";
import { GET as serialsGET } from "@/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route";
import { GET as passGET } from "@/app/api/wallet/apple/v1/passes/[passTypeId]/[serial]/route";

type ForgeLike = {
  pki: {
    rsa: { generateKeyPair: (bits: number) => { publicKey: unknown; privateKey: unknown } };
    createCertificate: () => {
      publicKey: unknown;
      serialNumber: string;
      validity: { notBefore: Date; notAfter: Date };
      setSubject: (a: { name: string; value: string }[]) => void;
      setIssuer: (a: { name: string; value: string }[]) => void;
      sign: (key: unknown) => void;
    };
    certificateToPem: (c: unknown) => string;
    privateKeyToPem: (k: unknown) => string;
  };
};

/** Testte gercek imza: kendinden imzali sertifika (Apple zinciri degil, kutuphane zinciri dogrulamaz). */
function selfSignedPem(): { cert: string; key: string } {
  const forge = createRequire(import.meta.url)("node-forge") as ForgeLike;
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attrs = [{ name: "commonName", value: "test-pass" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return { cert: forge.pki.certificateToPem(cert), key: forge.pki.privateKeyToPem(keys.privateKey) };
}

const b64 = (s: string) => Buffer.from(s).toString("base64");
const PASS_TYPE = "pass.example.test";
let pem: { cert: string; key: string };
let googleKey: string;

const ORIGINAL = { secret: process.env.AUTH_SECRET, base: process.env.NEXT_PUBLIC_BASE_URL };
beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.NEXT_PUBLIC_BASE_URL = "https://example.test";
  pem = selfSignedPem();
  googleKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
});
afterAll(() => {
  process.env.AUTH_SECRET = ORIGINAL.secret;
  process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL.base;
});

function enableApple() {
  vi.stubEnv("WALLET_APPLE_PASS_TYPE_ID", PASS_TYPE);
  vi.stubEnv("APPLE_TEAM_ID", "TEAM123456");
  vi.stubEnv("WALLET_APPLE_SIGNER_CERT_B64", b64(pem.cert));
  vi.stubEnv("WALLET_APPLE_SIGNER_KEY_B64", b64(pem.key));
  vi.stubEnv("WALLET_APPLE_WWDR_CERT_B64", b64(pem.cert));
}
function enableGoogle() {
  vi.stubEnv("WALLET_GOOGLE_ISSUER_ID", "3388000000000000000");
  vi.stubEnv("WALLET_GOOGLE_SA_EMAIL", "wallet@example-project.iam.gserviceaccount.test");
  vi.stubEnv("WALLET_GOOGLE_SA_KEY_B64", b64(googleKey));
}
function disableAll() {
  for (const k of [...APPLE_WALLET_ENV, ...GOOGLE_WALLET_ENV]) vi.stubEnv(k, "");
}

async function booking(over: Partial<WalletBookingSource & { guestId: string | null }> = {}) {
  return {
    id: "8f7d6c5b-4a39-4821-9a1b-0c2d3e4f5a6b",
    guestId: "guest-1",
    status: "APPROVED",
    checkInTime: new Date("2026-12-01T09:00:00Z"),
    checkOutTime: new Date("2026-12-01T18:00:00Z"),
    bagCountS: 1,
    bagCountM: 1,
    bagCountXl: 0,
    qrCodeToken: await createQrToken({ bookingId: "b", guestId: "g", shopId: "s" }),
    locale: "en",
    updatedAt: new Date("2026-11-24T10:00:00.123Z"),
    shop: { name: "Example Shop", address: "1 Example Street", latitude: 41.01, longitude: 28.97, timezone: "Europe/Istanbul" },
    ...over,
  };
}

const LABELS = {
  shop: "Storage point", dropOff: "Drop-off", pickUp: "Pick-up", bags: "Bags", code: "Code",
  address: "Address", cancelled: "Cancelled", nearShop: "You are near {shop}",
};

beforeEach(() => {
  vi.clearAllMocks();
  disableAll();
  mockRateLimit.mockResolvedValue(true);
  mockRequireMobileUser.mockResolvedValue({ user: { id: "guest-1", role: "GUEST", email: null } });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("yapilandirma", () => {
  it("degisken yokken iki taraf da kapali", () => {
    expect(walletCapabilities()).toEqual({ walletApple: false, walletGoogle: false });
    expect(toMobileAppConfig({ minAppVersion: null, latestAppVersion: null })).toMatchObject({
      walletApple: false,
      walletGoogle: false,
    });
  });

  it("tek eksik degisken o tarafi kapatir", () => {
    enableApple();
    expect(walletCapabilities().walletApple).toBe(true);
    vi.stubEnv("WALLET_APPLE_WWDR_CERT_B64", "");
    expect(walletCapabilities().walletApple).toBe(false);
  });

  it("Google ancak uc degiskenle acilir", () => {
    enableGoogle();
    expect(walletCapabilities()).toEqual({ walletApple: false, walletGoogle: true });
  });

  it("PEM base64 ya da duz gelir; PEM olmayan deger reddedilir", () => {
    expect(decodePem(b64(pem.cert))).toContain("BEGIN CERTIFICATE");
    expect(decodePem(pem.cert)).toContain("BEGIN CERTIFICATE");
    expect(decodePem(b64("not a pem"))).toBeNull();
    enableApple();
    vi.stubEnv("WALLET_APPLE_SIGNER_KEY_B64", b64("garbage"));
    expect(readAppleWalletConfig()).toBeNull();
  });
});

describe("bag token'i", () => {
  it("dogru tur icin rezervasyonu verir, baska tur icin vermez", async () => {
    const { token } = await signWalletLinkToken("bk-1", "apple");
    expect(await verifyWalletLinkToken(token, "apple")).toBe("bk-1");
    expect(await verifyWalletLinkToken(token, "google")).toBeNull();
  });

  it("suresi dolan token reddedilir", async () => {
    const { token } = await signWalletLinkToken("bk-1", "apple", new Date(Date.now() - 1000));
    expect(await verifyWalletLinkToken(token, "apple")).toBeNull();
  });

  it("QR ve afis token'i wallet bagi olarak gecmez", async () => {
    const qr = await createQrToken({ bookingId: "bk-1", guestId: "g", shopId: "s" });
    expect(await verifyWalletLinkToken(qr, "apple")).toBeNull();
    const { token: poster } = await signPosterLinkToken("shop-1");
    expect(await verifyWalletLinkToken(poster, "apple")).toBeNull();
  });

  it("aud tasiyan ama ad alani karisik token reddedilir", async () => {
    const forged = await new SignJWT({ walletBookingId: "bk-1", walletKind: "apple", bookingId: "bk-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("bagajpark")
      .setAudience("bagajpark:wallet")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
    expect(await verifyWalletLinkToken(forged, "apple")).toBeNull();
  });

  it("PassKit kimligi seri numarasina bagli", () => {
    const tok = passAuthenticationToken("bk-1");
    expect(tok.length).toBeGreaterThanOrEqual(16);
    expect(verifyPassAuthorization(`ApplePass ${tok}`, "bk-1")).toBe(true);
    expect(verifyPassAuthorization(`ApplePass ${tok}`, "bk-2")).toBe(false);
    expect(verifyPassAuthorization(null, "bk-1")).toBe(false);
    expect(verifyPassAuthorization(`Bearer ${tok}`, "bk-1")).toBe(false);
  });
});

describe("kart icerigi", () => {
  it("Apple: dukkan, saatler, valiz, QR = bugunku token, kilit ekrani konumu", async () => {
    const b = await booking();
    const c = walletPassContent(b, "en")!;
    const json = buildApplePassJson(c, LABELS, {
      passTypeId: PASS_TYPE, teamId: "TEAM123456", webServiceURL: "https://example.test/api/wallet/apple", authenticationToken: "x".repeat(20),
    });
    expect(json.serialNumber).toBe(b.id);
    expect(json.barcodes[0]).toMatchObject({ format: "PKBarcodeFormatQR", message: b.qrCodeToken });
    expect(json.relevantDate).toBe(b.checkInTime.toISOString());
    expect(json.locations?.[0]).toMatchObject({ latitude: 41.01, longitude: 28.97, relevantText: "You are near Example Shop" });
    expect(json.eventTicket.headerFields[0].value).toBe(2);
    expect(json.eventTicket.primaryFields[0].value).toBe("Example Shop");
    expect(json.eventTicket.secondaryFields.map((f) => f.key)).toEqual(["dropOff", "pickUp"]);
    expect(json).not.toHaveProperty("voided");
    // Misafirin ekraninda olmayan veri yok: fiyat, telefon, e-posta, isim.
    const text = JSON.stringify(json);
    expect(text).not.toMatch(/price|phone|email|guest/i);
  });

  it("iptal ve teslim edilmis kart voided / EXPIRED", async () => {
    for (const status of ["CANCELLED", "CHECKED_OUT"]) {
      const c = walletPassContent(await booking({ status }), "en")!;
      expect(c.inactive).toBe(true);
      expect(buildApplePassJson(c, LABELS, { passTypeId: "p", teamId: "t", webServiceURL: "u", authenticationToken: "a" }).voided).toBe(true);
      expect(buildGoogleGenericObject(c, LABELS, { issuerId: "1", logoUrl: "https://example.test/l.png", uiLocale: "en" }).state).toBe("EXPIRED");
    }
  });

  it("gecici ya da bos QR'li rezervasyona kart yok; konumsuz dukkanda konum yok", async () => {
    expect(walletPassContent(await booking({ qrCodeToken: "temp_x" }), "en")).toBeNull();
    expect(walletPassContent(await booking({ qrCodeToken: null }), "en")).toBeNull();
    const c = walletPassContent(await booking({ shop: { name: "S", address: null, latitude: null, longitude: null, timezone: null } }), "en")!;
    const json = buildApplePassJson(c, LABELS, { passTypeId: "p", teamId: "t", webServiceURL: "u", authenticationToken: "a" });
    expect(json).not.toHaveProperty("locations");
    expect(json.eventTicket.backFields).toEqual([]);
  });

  it("Google nesnesi: kimlik bicimi, QR ve aktif durum", async () => {
    const b = await booking();
    const obj = buildGoogleGenericObject(walletPassContent(b, "en")!, LABELS, { issuerId: "3388", logoUrl: "https://example.test/l.png", uiLocale: "en" });
    expect(obj.id).toBe(googleObjectId("3388", b.id));
    expect(obj.id).toMatch(/^3388\.[A-Za-z0-9._-]+$/);
    expect(obj.barcode).toMatchObject({ type: "QR_CODE", value: b.qrCodeToken });
    expect(obj.state).toBe("ACTIVE");
  });

  it("gercek imzali .pkpass uretir (zip)", async () => {
    enableApple();
    mockPrisma.booking.findUnique.mockResolvedValue(await booking());
    const built = await new WalletPassService().buildApplePass("x");
    expect(built).not.toBeNull();
    expect(built!.pass.subarray(0, 2).toString()).toBe("PK");
    expect(built!.pass.includes(Buffer.from("manifest.json"))).toBe(true);
    expect(built!.pass.includes(Buffer.from("signature"))).toBe(true);
  }, 30_000);
});

describe("yapilandirilmamisken kapali", () => {
  it("bag uclari 404 ve veritabanina gitmez", async () => {
    const { token } = await signWalletLinkToken("bk-1", "apple");
    const res = await appleLinkGET(new NextRequest(`https://example.test/api/wallet/apple?t=${token}`));
    expect(res.status).toBe(404);
    const g = await googleLinkGET(new NextRequest(`https://example.test/api/wallet/google?t=${token}`));
    expect(g.status).toBe(404);
    expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it("degisiklik bildirimi hicbir sorgu yapmaz", async () => {
    await new WalletPassService().notifyBookingChanged("bk-1");
    expect(mockPrisma.walletPassDevice.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it("e-posta ve web bagi bos", async () => {
    const svc = new WalletPassService();
    expect(await svc.linksForEmail("bk-1")).toEqual([]);
    expect(await svc.linksForVerifiedOwner({ id: "bk-1", status: "APPROVED", qrCodeToken: "x" })).toEqual([]);
  });

  it("mobil uc 404 not_configured", async () => {
    const res = (await mobileWalletGET(new NextRequest("https://example.test/api/mobile/bookings/bk-1/wallet?kind=apple"), {
      params: Promise.resolve({ id: "bk-1" }),
    }))!;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_configured");
  });

  it("PassKit uclari bilinmeyen pass type icin 404", async () => {
    const res = await serialsGET(new NextRequest(`https://example.test/x`), {
      params: Promise.resolve({ deviceId: "dev1", passTypeId: PASS_TYPE }),
    });
    expect(res.status).toBe(404);
  });
});

describe("erisim", () => {
  const mobileReq = async (kind = "apple") =>
    (await mobileWalletGET(new NextRequest(`https://example.test/api/mobile/bookings/bk-1/wallet?kind=${kind}`), {
      params: Promise.resolve({ id: "bk-1" }),
    }))!;

  it("misafirin kendisi kisa omurlu bag alir", async () => {
    enableApple();
    mockPrisma.booking.findUnique.mockResolvedValue(await booking({ id: "bk-1" }));
    const res = await mobileReq();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("apple");
    expect(body.url).toMatch(/^https:\/\/example\.test\/api\/wallet\/apple\?t=/);
    const t = new URL(body.url).searchParams.get("t")!;
    expect(await verifyWalletLinkToken(t, "apple")).toBe("bk-1");
    expect(new Date(body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000 + 1000);
  });

  it("baska kullanicinin rezervasyonu 404 (varlik sizdirilmaz), yonetici dahil", async () => {
    enableApple();
    mockPrisma.booking.findUnique.mockResolvedValue(await booking({ id: "bk-1", guestId: "someone-else" }));
    expect((await mobileReq()).status).toBe(404);
    mockRequireMobileUser.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN", email: null } });
    expect((await mobileReq()).status).toBe(404);
  });

  it("yonetici goruntuleme oturumunda 403", async () => {
    enableApple();
    mockRequireMobileUser.mockResolvedValue({ user: { id: "guest-1", role: "GUEST", email: null, impersonatedBy: "admin-1" } });
    expect((await mobileReq()).status).toBe(403);
  });

  it("iptal edilmis rezervasyona yeni kart verilmez (409)", async () => {
    enableApple();
    mockPrisma.booking.findUnique.mockResolvedValue(await booking({ id: "bk-1", status: "CANCELLED" }));
    expect((await mobileReq()).status).toBe(409);
  });

  it("gecersiz tur 400, hiz siniri 429", async () => {
    enableApple();
    expect((await mobileReq("samsung")).status).toBe(400);
    mockRateLimit.mockResolvedValue(false);
    expect((await mobileReq()).status).toBe(429);
  });

  it("bag ucu: token yoksa / sahteyse 403, rezervasyon kimligi tek basina yetmez", async () => {
    enableApple();
    expect((await appleLinkGET(new NextRequest("https://example.test/api/wallet/apple?t=bk-1"))).status).toBe(403);
    const { token } = await signWalletLinkToken("bk-1", "google");
    expect((await appleLinkGET(new NextRequest(`https://example.test/api/wallet/apple?t=${token}`))).status).toBe(403);
    expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it("bag ucu: gecerli token .pkpass doner", async () => {
    enableApple();
    mockPrisma.booking.findUnique.mockResolvedValue(await booking({ id: "bk-1" }));
    const { token } = await signWalletLinkToken("bk-1", "apple");
    const res = await appleLinkGET(new NextRequest(`https://example.test/api/wallet/apple?t=${token}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.apple.pkpass");
  }, 30_000);

  it("Google bagi kaydetme sayfasina yonlendirir", async () => {
    enableGoogle();
    mockPrisma.booking.findUnique.mockResolvedValue(await booking({ id: "bk-1" }));
    const { token } = await signWalletLinkToken("bk-1", "google");
    const res = await googleLinkGET(new NextRequest(`https://example.test/api/wallet/google?t=${token}`));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\/[\w-]+\.[\w-]+\.[\w-]+$/);
  });
});

describe("PassKit web servisi", () => {
  const regParams = (serial = "bk-1") => ({ params: Promise.resolve({ deviceId: "dev1", passTypeId: PASS_TYPE, serial }) });
  const regReq = (auth: string | null, body: unknown = { pushToken: "abc123" }) =>
    new NextRequest("https://example.test/x", {
      method: "POST",
      headers: auth ? { authorization: auth, "content-type": "application/json" } : { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("kimliksiz ya da baska seri icin kimlikle kayit 401", async () => {
    enableApple();
    expect((await registerPOST(regReq(null), regParams())).status).toBe(401);
    expect((await registerPOST(regReq(`ApplePass ${passAuthenticationToken("bk-2")}`), regParams())).status).toBe(401);
    expect(mockPrisma.walletPassDevice.upsert).not.toHaveBeenCalled();
  });

  it("ilk kayit 201, tekrari 200; silme 200", async () => {
    enableApple();
    mockPrisma.booking.findUnique.mockResolvedValue({ id: "bk-1" });
    mockPrisma.walletPassDevice.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "r1" });
    const auth = `ApplePass ${passAuthenticationToken("bk-1")}`;
    expect((await registerPOST(regReq(auth), regParams())).status).toBe(201);
    expect((await registerPOST(regReq(auth), regParams())).status).toBe(200);
    expect(mockPrisma.walletPassDevice.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { deviceLibraryId: "dev1", bookingId: "bk-1", pushToken: "abc123" },
    }));
    const del = await registerDELETE(new NextRequest("https://example.test/x", { method: "DELETE", headers: { authorization: auth } }), regParams());
    expect(del.status).toBe(200);
    expect(mockPrisma.walletPassDevice.deleteMany).toHaveBeenCalledWith({ where: { deviceLibraryId: "dev1", bookingId: "bk-1" } });
  });

  it("gecersiz push token 400", async () => {
    enableApple();
    const auth = `ApplePass ${passAuthenticationToken("bk-1")}`;
    expect((await registerPOST(regReq(auth, { pushToken: "<x>" }), regParams())).status).toBe(400);
  });

  it("degisen seri listesi etiketten sonrasini verir, yoksa 204", async () => {
    enableApple();
    mockPrisma.walletPassDevice.findMany.mockResolvedValue([
      { booking: { id: "bk-1", updatedAt: new Date(2000) } },
      { booking: { id: "bk-2", updatedAt: new Date(5000) } },
    ]);
    const p = { params: Promise.resolve({ deviceId: "dev1", passTypeId: PASS_TYPE }) };
    const res = await serialsGET(new NextRequest("https://example.test/x?passesUpdatedSince=3000"), p);
    expect(await res.json()).toEqual({ serialNumbers: ["bk-2"], lastUpdated: "5000" });
    const none = await serialsGET(new NextRequest("https://example.test/x?passesUpdatedSince=5000"), p);
    expect(none.status).toBe(204);
  });

  it("guncel kart: kimlik ister, degismediyse 304", async () => {
    enableApple();
    const b = await booking({ id: "bk-1" });
    mockPrisma.booking.findUnique.mockResolvedValue(b);
    const p = { params: Promise.resolve({ passTypeId: PASS_TYPE, serial: "bk-1" }) };
    expect((await passGET(new NextRequest("https://example.test/x"), p)).status).toBe(401);
    const auth = `ApplePass ${passAuthenticationToken("bk-1")}`;
    const fresh = await passGET(new NextRequest("https://example.test/x", { headers: { authorization: auth } }), p);
    expect(fresh.status).toBe(200);
    const cached = await passGET(
      new NextRequest("https://example.test/x", { headers: { authorization: auth, "if-modified-since": b.updatedAt.toUTCString() } }),
      p,
    );
    expect(cached.status).toBe(304);
  }, 30_000);
});

describe("onay e-postasi", () => {
  it("wallet dugmeleri kacirilmis olarak cizilir; verilmezse yok", () => {
    const base = { locale: "en", heading: "h", paragraphs: [], footer: "f" };
    expect(renderEmailHtml(base)).not.toContain("Wallet");
    const html = renderEmailHtml({ ...base, walletButtons: [{ href: "https://example.test/api/wallet/apple?t=a&b", label: "Add to Apple Wallet" }] });
    expect(html).toContain("Add to Apple Wallet");
    expect(html).toContain("t=a&amp;b");
  });

  it("e-posta bagi QR omru kadar gecerli (cikis + 24 saat)", async () => {
    enableApple();
    const b = await booking({ id: "bk-1", checkOutTime: new Date(Date.now() + 10 * 86_400_000) });
    mockPrisma.booking.findUnique.mockResolvedValue(b);
    const [link] = await new WalletPassService().linksForEmail("bk-1");
    expect(link.kind).toBe("apple");
    expect(Math.abs(link.expiresAt.getTime() - (b.checkOutTime.getTime() + 86_400_000))).toBeLessThan(2000);
  });
});
