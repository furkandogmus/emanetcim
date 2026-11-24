import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BookingStatus } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { getSiteBaseUrl } from "@/lib/site-base-url";
import { APP_LOCALES, DEFAULT_APP_LOCALE, type AppLocale } from "@/i18n/locales";
import {
  readAppleWalletConfig,
  readGoogleWalletConfig,
  walletCapabilities,
  type AppleWalletConfig,
  type WalletCapabilities,
} from "@/lib/wallet/config";
import {
  passAuthenticationToken,
  signWalletLinkToken,
  type WalletKind,
} from "@/lib/wallet/link-token";
import {
  buildApplePassJson,
  buildGoogleGenericObject,
  walletPassContent,
  type WalletBookingSource,
  type WalletLabels,
} from "@/lib/wallet/pass-content";
import { sendPassUpdatePushes } from "@/lib/wallet/apns";
import { googleSaveUrl, patchGoogleObject } from "@/lib/wallet/google";

/** Kart verilebilen durumlar: misafirin QR'i gecerli olan rezervasyon. */
const ISSUABLE_STATUSES = new Set(["APPROVED", "PAID", "CHECKED_IN", "WAITING_APPROVAL"]);

const BOOKING_SELECT = {
  id: true,
  guestId: true,
  status: true,
  checkInTime: true,
  checkOutTime: true,
  bagCountS: true,
  bagCountM: true,
  bagCountXl: true,
  qrCodeToken: true,
  locale: true,
  updatedAt: true,
  shop: { select: { name: true, address: true, latitude: true, longitude: true, timezone: true } },
} as const;

/** Bir kart icin tutulan en fazla cihaz kaydi; asilinca en eskisi duser. */
export const MAX_DEVICES_PER_PASS = 10;
/** Kapanmis kartin cihaz kayitlari bu kadar gun sonra silinir. */
export const FINISHED_PASS_RETENTION_DAYS = 30;

type WalletBookingRow = WalletBookingSource & { guestId: string | null };

export type WalletLink = { kind: WalletKind; url: string; expiresAt: Date };

function uiLocale(locale: string | null | undefined): AppLocale {
  return (APP_LOCALES as readonly string[]).includes(locale ?? "") ? (locale as AppLocale) : DEFAULT_APP_LOCALE;
}

async function walletLabels(locale: AppLocale): Promise<WalletLabels> {
  const messages = (await import(`@/locales/${locale}.json`)).default as { Wallet: WalletLabels };
  return messages.Wallet;
}

/** Apple kart gorselleri `public/icons`ten; ayri bir ikili dosya depoya girmez. */
async function passImages(): Promise<Record<string, Buffer>> {
  const dir = path.join(process.cwd(), "public", "icons");
  const [small, large] = await Promise.all([
    readFile(path.join(dir, "icon-192x192.png")),
    readFile(path.join(dir, "icon-512x512.png")),
  ]);
  return { "icon.png": small, "icon@2x.png": small, "icon@3x.png": large, "logo.png": small, "logo@2x.png": large };
}

export class WalletPassService {
  capabilities(): WalletCapabilities {
    return walletCapabilities();
  }

  private async load(bookingId: string): Promise<WalletBookingRow | null> {
    return prisma.booking.findUnique({ where: { id: bookingId }, select: BOOKING_SELECT });
  }

  private async signLink(bookingId: string, kind: WalletKind, expiresAt?: Date): Promise<WalletLink> {
    const signed = await signWalletLinkToken(bookingId, kind, expiresAt);
    const url = `${getSiteBaseUrl()}/api/wallet/${kind}?t=${encodeURIComponent(signed.token)}`;
    return { kind, url, expiresAt: signed.expiresAt };
  }

  /**
   * Sahibinin istedigi bag. Yalnizca misafirin kendisi (yonetici dahil baska
   * kimse degil): kart misafirin cuzdanina girer. Yapilandirilmamis tarafta null.
   */
  async linkForOwner(
    bookingId: string,
    userId: string,
    kind: WalletKind,
  ): Promise<{ ok: true; link: WalletLink } | { ok: false; code: "not_configured" | "not_found" | "not_available" }> {
    const caps = this.capabilities();
    if (!(kind === "apple" ? caps.walletApple : caps.walletGoogle)) return { ok: false, code: "not_configured" };
    const b = await this.load(bookingId);
    if (!b || b.guestId !== userId) return { ok: false, code: "not_found" };
    if (!ISSUABLE_STATUSES.has(b.status) || !walletPassContent(b, "tr")) return { ok: false, code: "not_available" };
    return { ok: true, link: await this.signLink(bookingId, kind) };
  }

  /** Web bilet sayfasi: sahiplik sayfada zaten dogrulandi; yalnizca acik taraflarin bagi. */
  async linksForVerifiedOwner(b: { id: string; status: string; qrCodeToken: string | null }): Promise<WalletLink[]> {
    const caps = this.capabilities();
    if (!caps.walletApple && !caps.walletGoogle) return [];
    if (!ISSUABLE_STATUSES.has(b.status) || !b.qrCodeToken || b.qrCodeToken.startsWith("temp_")) return [];
    const kinds: WalletKind[] = [...(caps.walletApple ? ["apple" as const] : []), ...(caps.walletGoogle ? ["google" as const] : [])];
    return Promise.all(kinds.map((k) => this.signLink(b.id, k)));
  }

  /**
   * Onay e-postasi hangi dugmeleri gostersin. E-postaya imzali kart bagi girmez:
   * gunlerce acik kalan bir bag, QR'i tasiyan bir tasiyici token olurdu. Dugme
   * oturumlu bilet sayfasina gider; sahibi orada 15 dakikalik bagi alir.
   */
  async emailWalletKinds(bookingId: string): Promise<WalletKind[]> {
    const caps = this.capabilities();
    if (!caps.walletApple && !caps.walletGoogle) return [];
    const b = await this.load(bookingId);
    if (!b || !ISSUABLE_STATUSES.has(b.status) || !walletPassContent(b, "tr")) return [];
    return [...(caps.walletApple ? ["apple" as const] : []), ...(caps.walletGoogle ? ["google" as const] : [])];
  }

  /** Imzali `.pkpass`. Iptal / teslim edilmis rezervasyonda da doner (`voided`): cihaz guncellemesi bunu ister. */
  async buildApplePass(bookingId: string): Promise<{ pass: Buffer; lastModified: Date } | null> {
    const cfg = readAppleWalletConfig();
    if (!cfg) return null;
    const b = await this.load(bookingId);
    if (!b) return null;
    const locale = uiLocale(b.locale);
    const content = walletPassContent(b, locale);
    if (!content) return null;
    const passJson = buildApplePassJson(content, await walletLabels(locale), {
      passTypeId: cfg.passTypeId,
      teamId: cfg.teamId,
      webServiceURL: `${getSiteBaseUrl()}/api/wallet/apple`,
      authenticationToken: passAuthenticationToken(b.id),
    });
    // Yalnizca yapilandirilmis sunucuda yuklenir: kapaliyken kutuphane hic acilmaz.
    const { PKPass } = await import("passkit-generator");
    const pass = new PKPass(
      { ...(await passImages()), "pass.json": Buffer.from(JSON.stringify(passJson)) },
      {
        wwdr: cfg.wwdr,
        signerCert: cfg.signerCert,
        signerKey: cfg.signerKey,
        ...(cfg.signerKeyPassphrase ? { signerKeyPassphrase: cfg.signerKeyPassphrase } : {}),
      },
    );
    return { pass: pass.getAsBuffer(), lastModified: b.updatedAt };
  }

  async googleSaveUrlFor(bookingId: string): Promise<string | null> {
    const cfg = readGoogleWalletConfig();
    if (!cfg) return null;
    const b = await this.load(bookingId);
    if (!b || !ISSUABLE_STATUSES.has(b.status)) return null;
    const locale = uiLocale(b.locale);
    const content = walletPassContent(b, locale);
    if (!content) return null;
    const base = getSiteBaseUrl();
    const object = buildGoogleGenericObject(content, await walletLabels(locale), {
      issuerId: cfg.issuerId,
      logoUrl: `${base}/icons/icon-512x512.png`,
      uiLocale: locale,
    });
    const url = await googleSaveUrl(cfg, object, base);
    // Nesne ancak bag verildiyse var olabilir; yamalar yalniz bunlara gider.
    await prisma.walletGoogleObject.upsert({ where: { bookingId }, create: { bookingId }, update: {} });
    return url;
  }

  /** PassKit kayit ucu: 201 yeni, 200 zaten kayitli. Seri bilinmiyorsa null (404). */
  async registerDevice(deviceLibraryId: string, bookingId: string, pushToken: string): Promise<201 | 200 | null> {
    const exists = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true } });
    if (!exists) return null;
    const prev = await prisma.walletPassDevice.findUnique({
      where: { deviceLibraryId_bookingId: { deviceLibraryId, bookingId } },
      select: { id: true },
    });
    await prisma.walletPassDevice.upsert({
      where: { deviceLibraryId_bookingId: { deviceLibraryId, bookingId } },
      create: { deviceLibraryId, bookingId, pushToken },
      update: { pushToken },
    });
    // Kart dosyasi paylasilabilir: tek seri sinirsiz cihaz kaydi ve push uretemesin.
    const overflow = await prisma.walletPassDevice.findMany({
      where: { bookingId },
      orderBy: { updatedAt: "desc" },
      skip: MAX_DEVICES_PER_PASS,
      select: { id: true },
    });
    if (overflow.length > 0) {
      await prisma.walletPassDevice.deleteMany({ where: { id: { in: overflow.map((r) => r.id) } } });
    }
    return prev ? 200 : 201;
  }

  async unregisterDevice(deviceLibraryId: string, bookingId: string): Promise<void> {
    await prisma.walletPassDevice.deleteMany({ where: { deviceLibraryId, bookingId } });
  }

  /**
   * Cihazin kartlarindan `since`ten sonra degisenler. Etiket rezervasyonun
   * `updatedAt` milisaniyesi: her yazim onu ilerletir, fazladan bir alan gerekmez.
   */
  async updatedSerials(
    deviceLibraryId: string,
    since: string | null,
  ): Promise<{ serialNumbers: string[]; lastUpdated: string } | null> {
    const rows = await prisma.walletPassDevice.findMany({
      where: { deviceLibraryId },
      select: { booking: { select: { id: true, updatedAt: true } } },
    });
    const sinceMs = since && /^\d+$/.test(since) ? Number(since) : 0;
    const changed = rows.map((r) => r.booking).filter((b) => b.updatedAt.getTime() > sinceMs);
    if (changed.length === 0) return null;
    const lastUpdated = Math.max(...changed.map((b) => b.updatedAt.getTime()));
    return { serialNumbers: changed.map((b) => b.id), lastUpdated: String(lastUpdated) };
  }

  /**
   * Rezervasyon degisti (saat, valiz, durum): Apple cihazlarina push, Google
   * nesnesine yama. Yapilandirilmamis tarafta hicbir sorgu yapilmaz.
   */
  async notifyBookingChanged(bookingId: string): Promise<void> {
    const apple = readAppleWalletConfig();
    const google = readGoogleWalletConfig();
    if (!apple && !google) return;
    await Promise.all([
      apple ? this.pushApple(apple, bookingId) : Promise.resolve(),
      google ? this.patchGoogle(bookingId) : Promise.resolve(),
    ]);
  }

  private async pushApple(cfg: AppleWalletConfig, bookingId: string): Promise<void> {
    const devices = await prisma.walletPassDevice.findMany({ where: { bookingId }, select: { pushToken: true } });
    const tokens = [...new Set(devices.map((d) => d.pushToken))];
    if (tokens.length === 0) return;
    const results = await sendPassUpdatePushes(cfg, tokens);
    // 410: kart cihazdan kaldirilmis; kaydi tutmak sonraki push'lari bosa harcar.
    const gone = results.filter((r) => r.status === 410).map((r) => r.token);
    if (gone.length > 0) {
      await prisma.walletPassDevice.deleteMany({ where: { bookingId, pushToken: { in: gone } } });
    }
    const failed = results.filter((r) => r.status !== 200 && r.status !== 410).length;
    if (failed > 0) logger.warn({ bookingId, failed }, "wallet_apple_push_failed");
  }

  private async patchGoogle(bookingId: string): Promise<void> {
    const cfg = readGoogleWalletConfig();
    if (!cfg) return;
    const saved = await prisma.walletGoogleObject.findUnique({ where: { bookingId }, select: { bookingId: true } });
    if (!saved) return;
    const b = await this.load(bookingId);
    if (!b) return;
    const locale = uiLocale(b.locale);
    const content = walletPassContent(b, locale);
    if (!content) return;
    const object = buildGoogleGenericObject(content, await walletLabels(locale), {
      issuerId: cfg.issuerId,
      logoUrl: `${getSiteBaseUrl()}/icons/icon-512x512.png`,
      uiLocale: locale,
    });
    await patchGoogleObject(cfg, object);
  }
}

/**
 * Gunluk temizlik (`cleanup` isi): iptal / teslim edilmis ve 30 gundur
 * degismemis rezervasyonlarin cihaz ve Google kayitlari. Kart zaten voided.
 */
export async function purgeFinishedWalletRecords(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - FINISHED_PASS_RETENTION_DAYS * 86_400_000);
  const where = { booking: { status: { in: ["CANCELLED", "CHECKED_OUT"] as BookingStatus[] }, updatedAt: { lt: cutoff } } };
  const [devices, objects] = await Promise.all([
    prisma.walletPassDevice.deleteMany({ where }),
    prisma.walletGoogleObject.deleteMany({ where }),
  ]);
  return devices.count + objects.count;
}

export const walletPassService = new WalletPassService();
