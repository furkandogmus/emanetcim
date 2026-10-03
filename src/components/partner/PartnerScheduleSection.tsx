import prisma from "@/lib/db";
import PartnerScheduleEditor from "./PartnerScheduleEditor";

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default async function PartnerScheduleSection({
  shop,
}: {
  shop: { id: string; open247: boolean; openingTime: string | null; closingTime: string | null };
}) {
  const [rows, closures] = await Promise.all([
    prisma.shopWeeklyHours.findMany({ where: { shopId: shop.id } }),
    prisma.shopClosure.findMany({
      where: { shopId: shop.id, endDate: { gte: new Date().toISOString().slice(0, 10) } },
      orderBy: { startDate: "asc" },
    }),
  ]);
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  const days = ISO_DAYS.map((weekday) => {
    const r = byDay.get(weekday);
    return {
      weekday,
      isClosed: r?.isClosed ?? false,
      openingTime: r?.openingTime ?? shop.openingTime ?? "09:00",
      closingTime: r?.closingTime ?? shop.closingTime ?? "20:00",
    };
  });
  return (
    <PartnerScheduleEditor
      shopId={shop.id}
      open247={shop.open247}
      days={days}
      closures={closures.map((c) => ({ id: c.id, startDate: c.startDate, endDate: c.endDate, reason: c.reason }))}
    />
  );
}
