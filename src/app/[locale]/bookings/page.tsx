import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { bookingService } from '@/services/BookingService';
import BookingsClient from '@/components/guest/BookingsClient';
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
  const bookings = await bookingService.getUserBookings(session.user.id);

  return <BookingsClient bookings={bookings} />;
}
