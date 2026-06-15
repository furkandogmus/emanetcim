import { setRequestLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { bookingService } from '@/services/BookingService';
import BookingsClient from '@/components/guest/BookingsClient';
import { getPricingRules } from '@/lib/platform-settings';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return {
    title: t("myBookings"),
    robots: { index: false, follow: false },
  };
}

/**
 * Guest Bookings Page - Rezervasyonlarım (Server Component)
 */
export default async function BookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/bookings`);
  }

  // Veritabanından kullanıcının kendi rezervasyonlarını çek
  const [bookingResult, pricingRules] = await Promise.all([
    bookingService.getUserBookings(session.user.id),
    getPricingRules(),
  ]);

  return (
    <BookingsClient
      bookings={JSON.parse(JSON.stringify(bookingResult.items))}
      pricingRules={JSON.parse(JSON.stringify(pricingRules))}
    />
  );
}
