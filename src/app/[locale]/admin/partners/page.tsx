import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { hoursForDate } from "@/lib/shop-schedule";
import { todayInZone } from "@/lib/stay-days";
import { loadScheduleParts } from "@/services/ShopScheduleService";
import { storageCitiesListingShop } from "@/lib/storage-cities";
import AdminPartnersClient from "@/components/admin/AdminPartnersClient";

export default async function AdminPartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const include = {
    owner: { select: { id: true, name: true, email: true, phone: true } },
    _count: { select: { bookings: true, reviews: true } },
  } as const;
  // Gercek dukkanlar SINIRSIZ: eskiden tek sorgu `take: 200` ile 490 talep testi
  // noktasiyla birlikte kesiliyordu ve en eski kayitlar (iki test dukkani) hic
  // gorunmuyordu (2026-11-19). Talep testi noktalari ayri sorguda.
  const [realShops, prelaunchShops] = await Promise.all([
    prisma.shop.findMany({
      where: { isPrelaunch: false },
      orderBy: [{ isActive: "asc" }, { createdAt: "desc" }],
      include,
    }),
    prisma.shop.findMany({
      where: { isPrelaunch: true },
      orderBy: [{ city: "asc" }, { name: "asc" }],
      take: 2000,
      include,
    }),
  ]);
  const shops = [...realShops, ...prelaunchShops];

  // Decimal alanları number’a çeviriyoruz (build hatası ve serileştirme için)
  const parts = await loadScheduleParts(
    shops.map((s) => s.id),
    new Date().toISOString().slice(0, 10),
  );
  const serializedShops = shops.map((shop) => {
    const tz = shop.timezone || "Europe/Istanbul";
    const hours = hoursForDate(
      { open247: shop.open247, openingTime: shop.openingTime, closingTime: shop.closingTime, timeZone: tz, ...parts.get(shop.id) },
      todayInZone(tz),
    );
    const hoursToday = !hours
      ? ({ kind: "closed" } as const)
      : shop.open247
        ? ({ kind: "open247" } as const)
        : ({ kind: "range", text: `${hours.open} – ${hours.close}` } as const);
    return { ...shop, hoursToday, cityPages: storageCitiesListingShop(shop) };
  }).map((shop) => ({
    ...shop,
    pricePerDay: Number(shop.pricePerDay),
    pricePerHour: Number(shop.pricePerHour),
    rating: shop.rating || 0,
    latitude: shop.latitude || null,
    longitude: shop.longitude || null,
  }));

  return <AdminPartnersClient shops={serializedShops} />;
}
