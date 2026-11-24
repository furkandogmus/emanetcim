import { randomUUID } from "crypto";

import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";
import { hasShopAccess } from "@/lib/shop-access";
import {
  buildObjectKey,
  getStorage,
  isStorageConfigured,
  readImageDimensions,
  sniffImageKind,
} from "@/lib/storage";
import { stripJpegMetadata } from "@/lib/storage/jpeg-strip";
import {
  BAG_PHOTO_KEY_PREFIX,
  BAG_PHOTO_MAX_BYTES,
  BAG_PHOTO_MAX_DIMENSION_PX,
  BAG_PHOTO_MAX_PER_BOOKING,
  BAG_PHOTO_URL_TTL_SECONDS,
  OPEN_DISPUTE_STATUSES,
  bagPhotoEditWindowOpen,
  bagPhotoRetentionCutoff,
  bagPhotoRetentionDue,
} from "@/lib/bag-photos";

/**
 * Valiz durumu fotograflari (2026-11-25). Web action'lari ve mobil uclar YALNIZ bunu cagirir.
 *
 * Yetki: misafirin kendisi gorur; dukkan operatoru (sahip/personel, `operate`) gorur ve
 * pencere acikken ekler/siler; yonetici gorur ve her zaman siler (denetim kaydiyla).
 * Goruntuleme (impersonation) oturumu yalniz okur.
 */

export type BagPhotoActor = { id: string; role: string; impersonatedBy?: string; ip?: string | null };
export type BagPhotoRelation = "admin" | "operator" | "guest";

export type BagPhotoView = { id: string; url: string; createdAt: string; expiresAt: string };
export type BagPhotoList = {
  photos: BagPhotoView[];
  canUpload: boolean;
  canDelete: boolean;
  maxPhotos: number;
  storageReady: boolean;
};

export type BagPhotoFailure =
  | "not_found"
  | "forbidden"
  | "read_only"
  | "storage_unavailable"
  | "rate_limited"
  | "locked"
  | "limit"
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "dimensions_too_large";

type Fail = { ok: false; reason: BagPhotoFailure };

const UPLOAD_LIMIT = { max: 30, windowMs: 10 * 60_000 };

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, guestId: true, status: true, checkedInAt: true, shop: { select: { id: true, ownerId: true } } },
  });
}
type BookingRow = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

export async function resolveBagPhotoRelation(actor: BagPhotoActor, booking: BookingRow): Promise<BagPhotoRelation | null> {
  if (actor.role === "ADMIN") return "admin";
  if (await hasShopAccess(actor, booking.shop, "operate")) return "operator";
  if (booking.guestId && booking.guestId === actor.id) return "guest";
  return null;
}

/** Bayt dogrulamasi + meta veri temizligi. Yalniz JPEG: HEIC'i istemci JPEG'e cevirir. */
export function prepareBagPhotoBytes(
  bytes: Uint8Array,
): { ok: true; body: Uint8Array } | { ok: false; reason: "empty" | "too_large" | "unsupported_type" | "dimensions_too_large" } {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > BAG_PHOTO_MAX_BYTES) return { ok: false, reason: "too_large" };
  if (sniffImageKind(bytes) !== "jpeg") return { ok: false, reason: "unsupported_type" };
  const dims = readImageDimensions(bytes, "jpeg");
  if (!dims || dims.width <= 0 || dims.height <= 0) return { ok: false, reason: "unsupported_type" };
  if (dims.width > BAG_PHOTO_MAX_DIMENSION_PX || dims.height > BAG_PHOTO_MAX_DIMENSION_PX) {
    return { ok: false, reason: "dimensions_too_large" };
  }
  const body = stripJpegMetadata(bytes);
  if (!body) return { ok: false, reason: "unsupported_type" };
  return { ok: true, body };
}

/** Nesneyi siler, sonra satiri. Nesne silinemezse satir `deletedAt` ile kalir; saklama isi yeniden dener. */
async function purgeRow(row: { id: string; key: string }): Promise<boolean> {
  try {
    await getStorage().remove(row.key);
  } catch (err) {
    logger.warn({ err, photoId: row.id }, "bag_photo_object_delete_failed");
    return false;
  }
  await prisma.bagPhoto.delete({ where: { id: row.id } }).catch((err: unknown) => {
    logger.warn({ err, photoId: row.id }, "bag_photo_row_delete_failed");
  });
  return true;
}

export class BagPhotoService {
  async list(actor: BagPhotoActor, bookingId: string, now = new Date()): Promise<({ ok: true } & BagPhotoList) | Fail> {
    const booking = await loadBooking(bookingId);
    if (!booking) return { ok: false, reason: "not_found" };
    const relation = await resolveBagPhotoRelation(actor, booking);
    if (!relation) return { ok: false, reason: "forbidden" };

    const writable = !actor.impersonatedBy;
    const windowOpen = bagPhotoEditWindowOpen(booking, now);
    const storageReady = isStorageConfigured();
    const base = {
      maxPhotos: BAG_PHOTO_MAX_PER_BOOKING,
      storageReady,
      canUpload: storageReady && writable && relation === "operator" && windowOpen,
      canDelete: storageReady && writable && (relation === "admin" || (relation === "operator" && windowOpen)),
    };
    if (!storageReady) return { ok: true, photos: [], ...base };

    const rows = await prisma.bagPhoto.findMany({
      where: { bookingId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, key: true, createdAt: true },
      take: BAG_PHOTO_MAX_PER_BOOKING,
    });
    const storage = getStorage();
    const expiresAt = new Date(now.getTime() + BAG_PHOTO_URL_TTL_SECONDS * 1000).toISOString();
    const photos = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        url: await storage.presignGet(r.key, BAG_PHOTO_URL_TTL_SECONDS),
        createdAt: r.createdAt.toISOString(),
        expiresAt,
      })),
    );
    return { ok: true, photos, ...base };
  }

  async upload(
    actor: BagPhotoActor,
    bookingId: string,
    bytes: Uint8Array,
    now = new Date(),
  ): Promise<{ ok: true; id: string } | Fail> {
    if (actor.impersonatedBy) return { ok: false, reason: "read_only" };
    if (!isStorageConfigured()) return { ok: false, reason: "storage_unavailable" };
    const booking = await loadBooking(bookingId);
    if (!booking) return { ok: false, reason: "not_found" };
    // Fotografi dukkan ceker; yonetici ve misafir yuklemez (urun karari).
    if ((await resolveBagPhotoRelation(actor, booking)) !== "operator") return { ok: false, reason: "forbidden" };
    if (!bagPhotoEditWindowOpen(booking, now)) return { ok: false, reason: "locked" };
    if (!(await rateLimit(`bag_photo_upload:user:${actor.id}`, UPLOAD_LIMIT.max, UPLOAD_LIMIT.windowMs))) {
      return { ok: false, reason: "rate_limited" };
    }
    const count = await prisma.bagPhoto.count({ where: { bookingId, deletedAt: null } });
    if (count >= BAG_PHOTO_MAX_PER_BOOKING) return { ok: false, reason: "limit" };

    const prepared = prepareBagPhotoBytes(bytes);
    if (!prepared.ok) return prepared;

    const key = buildObjectKey({ prefix: BAG_PHOTO_KEY_PREFIX, ownerId: bookingId, uniqueId: randomUUID(), extension: "jpg" });
    const storage = getStorage();
    await storage.putPrivate({ key, body: prepared.body, contentType: "image/jpeg" });
    let row: { id: string };
    try {
      row = await prisma.bagPhoto.create({ data: { bookingId, key, uploadedById: actor.id }, select: { id: true } });
    } catch (err) {
      void storage.remove(key).catch((e: unknown) => logger.warn({ err: e, bookingId }, "bag_photo_orphan_cleanup_failed"));
      throw err;
    }
    // Esz zamanli iki yukleme sayimi birlikte gecebilir: fazlaysa en yeni kendini geri alir.
    const after = await prisma.bagPhoto.count({ where: { bookingId, deletedAt: null } });
    if (after > BAG_PHOTO_MAX_PER_BOOKING) {
      await prisma.bagPhoto.update({ where: { id: row.id }, data: { deletedAt: now } });
      void purgeRow({ id: row.id, key }).catch((e: unknown) => logger.warn({ err: e, bookingId }, "bag_photo_race_cleanup_failed"));
      return { ok: false, reason: "limit" };
    }
    logger.info({ bookingId, photoId: row.id, bytes: prepared.body.length }, "bag_photo_uploaded");
    return { ok: true, id: row.id };
  }

  async remove(actor: BagPhotoActor, bookingId: string, photoId: string, now = new Date()): Promise<{ ok: true } | Fail> {
    if (actor.impersonatedBy) return { ok: false, reason: "read_only" };
    const booking = await loadBooking(bookingId);
    if (!booking) return { ok: false, reason: "not_found" };
    const relation = await resolveBagPhotoRelation(actor, booking);
    if (relation !== "admin" && relation !== "operator") return { ok: false, reason: "forbidden" };
    // Teslimden sonra kanit kilitli; yalniz yonetici (or. uygunsuz kare) kaldirabilir.
    if (relation === "operator" && !bagPhotoEditWindowOpen(booking, now)) return { ok: false, reason: "locked" };
    if (!(await rateLimit(`bag_photo_upload:user:${actor.id}`, UPLOAD_LIMIT.max, UPLOAD_LIMIT.windowMs))) {
      return { ok: false, reason: "rate_limited" };
    }
    const photo = await prisma.bagPhoto.findFirst({
      where: { id: photoId, bookingId, deletedAt: null },
      select: { id: true, key: true },
    });
    if (!photo) return { ok: false, reason: "not_found" };
    await prisma.bagPhoto.update({ where: { id: photo.id }, data: { deletedAt: now } });
    if (relation === "admin") {
      writeAuditLog({
        actorUserId: actor.id,
        actorRole: "ADMIN",
        action: "admin.booking.bag_photo_delete",
        entityType: "Booking",
        entityId: bookingId,
        metadata: { photoId },
        ip: actor.ip ?? null,
      });
    }
    if (isStorageConfigured()) await purgeRow(photo);
    return { ok: true };
  }

  /** Misafirin silinen hesabi: acik itirazi olmayan rezervasyonlarinin fotograflari isaretlenir. */
  markForGuestErasure(
    tx: Pick<typeof prisma, "bagPhoto">,
    userId: string,
    now: Date,
  ) {
    return tx.bagPhoto.updateMany({
      where: {
        deletedAt: null,
        booking: {
          guestId: userId,
          OR: [{ dispute: null }, { dispute: { status: { notIn: [...OPEN_DISPUTE_STATUSES] } } }],
        },
      },
      data: { deletedAt: now },
    });
  }

  /** `deletedAt` dolu satirlarin nesnelerini siler (hesap silme sonrasi hemen; is her gun). */
  async purgeMarked(limit = 200): Promise<{ removed: number; failed: number }> {
    if (!isStorageConfigured()) return { removed: 0, failed: 0 };
    const rows = await prisma.bagPhoto.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, key: true },
      take: limit,
    });
    let removed = 0;
    for (const r of rows) if (await purgeRow(r)) removed++;
    return { removed, failed: rows.length - removed };
  }

  /** Gunluk saklama isi: kurala gore suresi dolanlari siler (`bagPhotoDeleteAt`). */
  async runRetention(now = new Date(), batch = 500): Promise<{ scanned: number; removed: number; failed: number; kept: number }> {
    if (!isStorageConfigured()) return { scanned: 0, removed: 0, failed: 0, kept: 0 };
    const cutoff = bagPhotoRetentionCutoff(now);
    const candidates = await prisma.bagPhoto.findMany({
      where: {
        // Acik itirazlilar sorguda elenir: yoksa her gun ayni partiyi doldurup yenilerini bekletirdi.
        OR: [
          { deletedAt: { not: null } },
          {
            booking: {
              NOT: { dispute: { status: { in: [...OPEN_DISPUTE_STATUSES] } } },
              OR: [{ checkedOutAt: { lt: cutoff } }, { status: "CANCELLED", updatedAt: { lt: cutoff } }],
            },
          },
        ],
      },
      select: {
        id: true,
        key: true,
        deletedAt: true,
        booking: {
          select: {
            status: true,
            checkedOutAt: true,
            updatedAt: true,
            dispute: { select: { status: true, updatedAt: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: batch,
    });
    let removed = 0;
    let failed = 0;
    let kept = 0;
    for (const c of candidates) {
      if (!bagPhotoRetentionDue(c, now)) {
        kept++;
        continue;
      }
      if (await purgeRow(c)) removed++;
      else failed++;
    }
    return { scanned: candidates.length, removed, failed, kept };
  }
}

export const bagPhotoService = new BagPhotoService();
