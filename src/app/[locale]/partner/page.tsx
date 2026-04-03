import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { shopService } from "@/services/ShopService";
import { bookingService } from "@/services/BookingService";
import PartnerClient from "@/components/partner/PartnerClient";
import { redirect } from "next/navigation";
import { getMerchantShareRatio } from "@/lib/platform-split";

/**
 * esnaf Ana Sayfası - Partner Dashboard (Server Component)
 * Query: ?booking=<uuid> check-in akışı, ?checkoutBooking=<uuid> teslim onayı
 */
export default async function PartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ booking?: string; checkoutBooking?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = (await searchParams) ?? {};
  const initialBookingId = sp.booking?.trim() || undefined;
  const initialCheckoutBookingId = sp.checkoutBooking?.trim() || undefined;

  const session = await auth();

  if (!session?.user?.id || session.user.role !== "PARTNER") {
    if (session?.user?.role !== "ADMIN") {
      redirect(`/${locale}/login?callbackUrl=/${locale}/partner`);
    }
  }

  const shops = await shopService.getShopsByOwner(session!.user.id);
  const activeShop = shops[0];

  if (!activeShop) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-10 text-center">
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          Henüz Kayıtlı Dükkanınız Yok
        </h1>
        <p className="text-gray-500 mb-8 max-w-xs">
          İşletmenizi sisteme kaydetmek için admin onayı bekliyor olabilirsiniz.
        </p>
      </div>
    );
  }

  const bookings = await bookingService.getPartnerBookings(activeShop.id);
  const activeCount = bookings.filter(
    (b) => b.status === "PAID" || b.status === "CHECKED_IN"
  ).length;
  const totalEarnings = bookings.reduce(
    (sum, b) => sum + (b.status !== "CANCELLED" ? b.totalPrice : 0),
    0
  );

  const merchantShareRatio = getMerchantShareRatio();

  return (
    <PartnerClient
      shopId={activeShop.id}
      shopName={activeShop.name}
      activeCount={activeCount}
      totalEarnings={totalEarnings}
      merchantShareRatio={merchantShareRatio}
      initialCapacity={activeShop.capacity}
      initialOpening={activeShop.openingTime || "09:00"}
      initialClosing={activeShop.closingTime || "20:00"}
      initialPricePerDay={activeShop.pricePerDay || 50}
      bookings={JSON.parse(JSON.stringify(bookings))}
      initialBookingId={initialBookingId}
      initialCheckoutBookingId={initialCheckoutBookingId}
    />
  );
}
