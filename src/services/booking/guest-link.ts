import prisma from "@/lib/db";
import logger from "@/lib/logger";

/**
 * Hesapsiz (guestId = NULL) rezervasyonlari, e-postasi DOGRULANMIS hesaba baglar.
 *
 * Yalnizca dogrulanmis e-posta: kanitsiz sifreli kayit baskasinin adresini
 * yazip onun rezervasyonlarini (QR dahil) sahiplenebilirdi. Telefonla
 * baglanmaz: numara kanitlanmis bir kimlik degil. Her dogrulama noktasi
 * (kodla giris, e-posta baglantisi, sifre sifirlama) BU fonksiyonu cagirir.
 *
 * Hata akisi dusurmez: giris/sifirlama zaten basarili, baglama bir sonraki
 * dogrulamada tekrar denenir (idempotent). Doner: baglanan rezervasyon sayisi.
 */
export async function linkGuestBookingsToVerifiedUser(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    });
    if (!user?.email || !user.emailVerified) return 0;
    const email = user.email.trim().toLowerCase();

    /*
      `mode: insensitive` Postgres'te ILIKE uretir ve `_`/`%` joker sayilir:
      `a_b@x.com` `axb@x.com`u yakalardi. Aday listesi tam esitlikle suzulur.
    */
    const candidates = await prisma.booking.findMany({
      where: { guestId: null, guestEmail: { equals: email, mode: "insensitive" } },
      select: { id: true, guestEmail: true },
    });
    const ids = candidates
      .filter((b) => b.guestEmail?.trim().toLowerCase() === email)
      .map((b) => b.id);
    if (ids.length === 0) return 0;

    // `guestId: null` tekrar: arada baska bir hesaba baglanmis satir ezilmez.
    const { count } = await prisma.booking.updateMany({
      where: { id: { in: ids }, guestId: null },
      data: { guestId: userId },
    });
    logger.info({ userId, count }, "guest_bookings_linked");
    return count;
  } catch (err) {
    logger.error({ err, userId }, "guest_bookings_link_failed");
    return 0;
  }
}
