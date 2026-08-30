import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { BookingStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/**
 * Admin rezervasyon araması — TEK YER.
 *
 * NEDEN VAR: 2026-08-30'da ölçüldü ki `Booking` admin tarafında YALNIZCA
 * `admin/page.tsx` içinde okunuyordu ve orada da sadece `count` / `aggregate` /
 * son kayıtlar olarak. Yani tek bir rezervasyonu arayıp açacak hiçbir ekran
 * yoktu: misafir "param gitti, kod çalışmıyor" diye yazdığında yöneticinin
 * elindeki tek araç psql'di.
 *
 * ARAMA ALANLARI, destek talebinin GERÇEKTE getirdiği şeye göre seçildi:
 * misafir elindeki kodu (rezervasyon id ya da QR jetonu), e-postasını veya
 * telefonunu yazar; esnaf ise dükkan adını söyler. Bunların hepsi tek bir
 * kutuya girer — yöneticinin "bu numara hangi alan?" diye düşünmesi gereken
 * bir arayüz, aramanın kendisinden daha yavaştır.
 *
 * HESAPSIZ (guest checkout) REZERVASYON: `guestId` boş olabilir, kimlik
 * `guestEmail`/`guestPhone` alanlarında durur. Yalnızca `guest` ilişkisinde
 * arayan bir sorgu bu rezervasyonları HİÇ bulamazdı — ve destek talebi tam da
 * hesabı olmayan kullanıcıdan gelir.
 */

/** Tek sayfada gösterilen en fazla kayıt. Liste değil, arama sonucudur. */
export const ADMIN_BOOKING_SEARCH_LIMIT = 50;

export type AdminBookingRow = {
  id: string;
  status: string;
  createdAt: string;
  checkInTime: string;
  checkOutTime: string;
  totalPrice: number;
  bagCount: number;
  shopName: string;
  /** Hesaplı kullanıcı adı ya da guest checkout e-postası; ikisi de yoksa null. */
  guestLabel: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  /** Ödeme defteri satırı hiç açılmamış olabilir. */
  paymentStatus: string | null;
  hasDispute: boolean;
};

/**
 * Sorguyu Prisma koşuluna çevirir.
 *
 * `id` ve `qrCodeToken` TAM eşleşme arar, geri kalanı içerir (`contains`):
 * yöneticinin yapıştırdığı bir id'nin parçası başka bir rezervasyonun id'sinde
 * geçebilir ve kesin arama, kesin cevap vermelidir.
 */
function buildWhere(query: string): Prisma.BookingWhereInput | undefined {
  const q = query.trim();
  if (!q) return undefined;

  const insensitive = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { id: q },
      { qrCodeToken: q },
      { guestEmail: insensitive },
      { guestPhone: insensitive },
      { referredByCode: insensitive },
      { guest: { email: insensitive } },
      { guest: { name: insensitive } },
      { guest: { phone: insensitive } },
      { shop: { name: insensitive } },
    ],
  };
}

/**
 * Rezervasyon arar. Sorgu boşsa EN YENİ kayıtları döner — boş bir ekran,
 * "arama kutusuna ne yazacağımı bilmiyorum" durumundaki yöneticiye hiçbir şey
 * öğretmez; son rezervasyonlar öğretir.
 */
export async function searchAdminBookings(
  query: string,
  status?: string,
): Promise<AdminBookingRow[]> {
  const where = buildWhere(query);
  /*
    Durum URL'den geliyor. Dogrulamadan Prisma'ya verilirse gecersiz bir enum
    degeri (`?status=bogus`) sorguyu FIRLATTIRIR ve yonetici 500 gorur --
    yazim hatasinin cezasi bos bir liste olmali, cokme degil.
  */
  const statusFilter =
    status && status !== "ALL" && status in BookingStatus
      ? { status: status as BookingStatus }
      : undefined;

  const rows = await prisma.booking.findMany({
    where: where && statusFilter ? { AND: [where, statusFilter] } : (where ?? statusFilter),
    orderBy: { createdAt: "desc" },
    take: ADMIN_BOOKING_SEARCH_LIMIT,
    select: {
      id: true,
      status: true,
      createdAt: true,
      checkInTime: true,
      checkOutTime: true,
      totalPrice: true,
      bagCountS: true,
      bagCountM: true,
      bagCountXl: true,
      guestEmail: true,
      guestPhone: true,
      guest: { select: { name: true, email: true, phone: true } },
      shop: { select: { name: true } },
      paymentLog: { select: { status: true } },
      dispute: { select: { id: true } },
    },
  });

  return rows.map((b) => ({
    id: b.id,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    checkInTime: b.checkInTime.toISOString(),
    checkOutTime: b.checkOutTime.toISOString(),
    totalPrice: moneyToNumber(b.totalPrice),
    bagCount: b.bagCountS + b.bagCountM + b.bagCountXl,
    shopName: b.shop.name,
    guestLabel: b.guest?.name ?? b.guest?.email ?? b.guestEmail ?? null,
    guestEmail: b.guest?.email ?? b.guestEmail,
    guestPhone: b.guest?.phone ?? b.guestPhone,
    paymentStatus: b.paymentLog?.status ?? null,
    hasDispute: b.dispute !== null,
  }));
}
