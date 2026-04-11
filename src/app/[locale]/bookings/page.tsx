import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { bookingService } from '@/services/BookingService';
import BookingsClient from '@/components/guest/BookingsClient';
import { getPricingRules } from '@/lib/platform-settings';
import { redirect } from 'next/navigation';

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
  const [bookings, pricingRules] = await Promise.all([
    bookingService.getUserBookings(session.user.id),
    getPricingRules(),
  ]);

  return (
    <BookingsClient
      bookings={JSON.parse(JSON.stringify(bookings))}
      pricingRules={JSON.parse(JSON.stringify(pricingRules))}
    />
  );
}
