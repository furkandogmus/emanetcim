"use client";

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Calendar,
  MapPin,
  Clock,
  QrCode,
  Menu,
  User,
  CreditCard,
  CircleHelp,
  ChevronRight,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { moneyToNumber } from '@/lib/money';
import { formatTryCurrency } from '@/lib/currency';
import { guestBookingStatusMessageKey } from '@/lib/booking-status-i18n';
import { toast } from 'sonner';
import ReviewForm from './ReviewForm';
import CancellationPolicy from '@/components/guest/CancellationPolicy';
import BookingModifyModal, {
  canGuestModifyBooking,
} from '@/components/guest/BookingModifyModal';
import type { GuestBookingListItem } from '@/services/BookingService';
import type { PricingRules } from '@/lib/pricing-rules';
import { dateLocaleForUiLocale } from '@/lib/date-locale';
import { signOut } from 'next-auth/react';

interface BookingsClientProps {
  bookings: GuestBookingListItem[];
  pricingRules: PricingRules;
}

/**
 * BookingsClient - Client-side animations and list display.
 */
function statusBadgeClass(status: string): string {
  if (status === "PAID") return "bg-green-100 text-green-700";
  if (status === "CHECKED_IN") return "bg-blue-100 text-blue-700";
  if (status === "CHECKED_OUT") return "bg-slate-100 text-slate-700";
  if (status === "APPROVED") return "bg-amber-100 text-amber-800";
  if (status === "WAITING_APPROVAL") return "bg-orange-100 text-orange-800";
  if (status === "PENDING") return "bg-yellow-100 text-yellow-800";
  if (status === "CANCELLED") return "bg-gray-200 text-gray-600";
  return "bg-gray-100 text-gray-600";
}

export default function BookingsClient({
  bookings,
  pricingRules,
}: BookingsClientProps) {
  const t = useTranslations('Guest');
  const tErr = useTranslations('Errors');
  const tUserNav = useTranslations('UserNav');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const dateLocale = dateLocaleForUiLocale(locale);
  const router = useRouter();
  const [reviewBooking, setReviewBooking] = useState<GuestBookingListItem | null>(null);
  const [modifyBooking, setModifyBooking] = useState<GuestBookingListItem | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<GuestBookingListItem | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const isPastBooking = (status: string) =>
    status === 'CHECKED_OUT' || status === 'CANCELLED';
  const upcomingBookings = bookings.filter((b) => !isPastBooking(b.status));
  const pastBookings = bookings.filter((b) => isPastBooking(b.status));
  const featuredBooking = upcomingBookings[0] ?? bookings[0];
  const hasUpcoming = upcomingBookings.length > 0;
  const itemCount = (booking: GuestBookingListItem) =>
    booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  const pseudoPassCode = featuredBooking.id.replace(/-/g, '').slice(-4).toUpperCase();
  const mobileCopy =
    locale === 'tr'
      ? {
          loyaltyMember: 'Sadakat Üyesi',
          totalStays: 'Toplam Konaklama',
          storagePoints: 'Emanet Noktası',
          upcomingBooking: 'Yaklaşan Rezervasyon',
          latestBooking: 'Son Rezervasyon',
          activeReservation: 'Aktif Rezervasyon',
          passcode: 'Geçiş Kodu',
          pastBookings: 'Geçmiş Rezervasyonlar',
          account: 'Hesap',
          personalInfo: 'Kişisel Bilgiler',
          paymentPrivacy: 'Ödeme ve Gizlilik',
          helpCenter: 'Yardım Merkezi',
        }
      : {
          loyaltyMember: 'Loyalty Member',
          totalStays: 'Total Stays',
          storagePoints: 'Storage Points',
          upcomingBooking: 'Upcoming Booking',
          latestBooking: 'Latest Booking',
          activeReservation: 'Active Reservation',
          passcode: 'Passcode',
          pastBookings: 'Past Bookings',
          account: 'Account',
          personalInfo: 'Personal Information',
          paymentPrivacy: 'Payment & Privacy',
          helpCenter: 'Help Center',
        };

  if (bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 text-orange-600">
          <ShoppingBag size={40} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">{t('noBookingsTitle')}</h1>
        <p className="text-gray-500 max-w-xs mb-8 font-medium">{t('noBookingsDesc')}</p>
        <Link 
          href="/search" 
          className="btn-ui btn-ui-lg btn-ui-primary rounded-2xl"
        >
          {t('exploreShops')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white p-4 md:p-6">
        <Link
          href="/"
          className="md:hidden rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label={tCommon('mobileNavHome')}
        >
          <Menu size={20} aria-hidden />
        </Link>
        <Link
          href="/search"
          className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-orange-600 hidden md:inline-flex"
          aria-label={t('findShops')}
        >
          <MapPin size={22} aria-hidden />
        </Link>
        <h1 className="text-2xl font-black text-gray-900 flex-1">{t('myBookings')}</h1>
        <span className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-black">
          {tCommon('demoMisafir').slice(0, 1)}
        </span>
      </header>

      <main className="p-4 flex flex-col gap-4 max-w-2xl mx-auto md:hidden">
        <section className="rounded-[1.75rem] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#172554] text-white p-5 shadow-xl shadow-slate-200">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">
            {mobileCopy.loyaltyMember}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">{tCommon('demoMisafir')}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/60">{mobileCopy.totalStays}</p>
              <p className="mt-1 text-xl font-black">{bookings.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/60">{mobileCopy.storagePoints}</p>
              <p className="mt-1 text-xl font-black">
                {new Set(bookings.map((b) => b.shopId)).size}
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-between px-1">
          <h2 className="text-2xl font-black text-gray-900">
            {hasUpcoming ? mobileCopy.upcomingBooking : mobileCopy.latestBooking}
          </h2>
          <Link href={`/bookings/${featuredBooking.id}`} className="text-xs font-black text-orange-600 uppercase tracking-wider">
            {t('backToBookings')}
          </Link>
        </section>

        <article className="bg-white rounded-[1.75rem] border border-gray-100 p-4 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            {mobileCopy.activeReservation}
          </div>
          <h3 className="mt-3 text-2xl leading-tight font-black text-gray-900">
            {featuredBooking.shop?.name || t('defaultShopName')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {featuredBooking.shop?.address?.split(',')[0] || t('cityFallback')}
          </p>

          <div className="mt-4 rounded-3xl bg-slate-900 p-4 text-white">
            <div className="mx-auto h-28 w-28 rounded-2xl bg-white p-3">
              <div className="h-full w-full rounded-xl border border-gray-300 flex items-center justify-center text-gray-500">
                <QrCode size={44} />
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.24em] text-white/60">{mobileCopy.passcode}</p>
            <p className="text-center text-3xl font-black tracking-[0.6em] pl-[0.6em]">{pseudoPassCode}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase text-gray-400">{t('checkIn')}</p>
              <p className="mt-1 text-sm font-black text-gray-900">
                {new Date(featuredBooking.checkInTime).toLocaleDateString(dateLocale)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase text-gray-400">{t('bagCount')}</p>
              <p className="mt-1 text-sm font-black text-gray-900">
                {itemCount(featuredBooking)} {t('bagsUnit')}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/bookings/${featuredBooking.id}`}
                className="btn-ui btn-ui-lg btn-ui-primary w-full rounded-2xl"
              >
                {t('showQR')}
              </Link>
              <Link
                href={`/bookings/${featuredBooking.id}`}
                className="btn-ui btn-ui-lg btn-ui-secondary w-full rounded-2xl"
              >
                {t('backToBookings')}
              </Link>
            </div>
          </div>
        </article>

        {pastBookings.length > 0 ? (
          <section className="space-y-3">
            <h2 className="px-1 text-2xl font-black text-gray-900">{mobileCopy.pastBookings}</h2>
            {pastBookings.slice(0, 3).map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <Clock size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-bold text-gray-900">{booking.shop?.name || t('defaultShopName')}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(booking.checkInTime).toLocaleDateString(dateLocale)} • {formatTryCurrency(moneyToNumber(booking.totalPrice), locale)}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </Link>
            ))}
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="px-1 text-2xl font-black text-gray-900">{mobileCopy.account}</h2>
          <Link href="/account" className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <User size={18} className="text-gray-500" />
            <span className="font-bold text-gray-900">{mobileCopy.personalInfo}</span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
          <Link href="/account/privacy" className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <CreditCard size={18} className="text-gray-500" />
            <span className="font-bold text-gray-900">{mobileCopy.paymentPrivacy}</span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
          <Link href="/contact" className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <CircleHelp size={18} className="text-gray-500" />
            <span className="font-bold text-gray-900">{mobileCopy.helpCenter}</span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: `/${locale}` })}
            className="w-full text-left px-2 pt-2 text-xs font-bold text-red-600"
          >
            {tUserNav('signOut')}
          </button>
        </section>
      </main>

      <main className="p-4 flex-col gap-4 max-w-2xl mx-auto hidden md:flex">
        <AnimatePresence>
          {bookings.map((booking, index) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              {/* Status Badge */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{booking.shop?.name || t('defaultShopName')}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <MapPin size={10} />
                      {booking.shop?.address?.split(',')[0] || t('cityFallback')}
                    </div>
                  </div>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${statusBadgeClass(
                    booking.status as string
                  )}`}
                >
                  {(() => {
                    const k = guestBookingStatusMessageKey(booking.status as string);
                    return k ? t(k as never) : (booking.status as string);
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50">
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{t('checkIn')}</div>
                    <div className="text-sm font-bold text-gray-700">
                      {new Date(booking.checkInTime).toLocaleDateString(dateLocale)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-gray-400" />
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{t('bagCount')}</div>
                    <div className="text-sm font-bold text-gray-700">
                      {booking.bagCountS + booking.bagCountM + booking.bagCountXl} {t('bagsUnit')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-6 border-t border-gray-50">
                <div className="flex flex-col">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">{t('totalAmount')}</div>
                  <div className="text-xl font-black text-gray-900 tracking-tighter">
                    {formatTryCurrency(moneyToNumber(booking.totalPrice), locale)}
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap justify-end">
                  {canGuestModifyBooking(booking.status) && (
                    <button
                      type="button"
                      onClick={() => setModifyBooking(booking)}
                      className="btn-ui btn-ui-md btn-ui-secondary rounded-2xl"
                    >
                      {t('modifyBooking')}
                    </button>
                  )}
                  {(booking.status === 'PAID' ||
                    booking.status === 'PENDING' ||
                    booking.status === 'WAITING_APPROVAL' ||
                    booking.status === 'APPROVED') && (
                    <button
                      type="button"
                      onClick={() => setCancelModalBooking(booking)}
                      className="btn-ui btn-ui-md btn-ui-danger rounded-2xl"
                    >
                      {t('cancelBooking')}
                    </button>
                  )}

                  {booking.status === 'CHECKED_OUT' && (
                    <button 
                      onClick={() => setReviewBooking(booking)}
                      className="btn-ui btn-ui-md btn-ui-secondary rounded-2xl text-orange-600 border-orange-100 hover:bg-orange-50"
                    >
                      {t('evaluate')}
                    </button>
                  )}

                  {booking.status === 'CHECKED_OUT' && !booking.dispute && (
                    <Link
                      href={`/bookings/${booking.id}/dispute`}
                      className="btn-ui btn-ui-md btn-ui-secondary rounded-2xl text-gray-600"
                    >
                      {t('complaint')}
                    </Link>
                  )}
                  
                  {booking.status !== 'CANCELLED' && (
                    <Link 
                      href={`/bookings/${booking.id}`}
                      className="btn-ui btn-ui-md btn-ui-primary rounded-[1.25rem] bg-gray-900 hover:bg-black shadow-xl shadow-gray-200"
                    >
                      <QrCode size={16} strokeWidth={2.5} />
                      {t('showQR')}
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </main>

      {reviewBooking && (
        <ReviewForm 
          bookingId={reviewBooking.id}
          guestId={reviewBooking.guestId ?? ""}
          shopId={reviewBooking.shopId}
          shopName={reviewBooking.shop?.name || t('defaultShopName')}
          onClose={() => setReviewBooking(null)}
          onSuccess={() => {
            setReviewBooking(null);
            toast.success(t('reviewThanks'));
            router.refresh();
          }}
        />
      )}

      {modifyBooking && (
        <BookingModifyModal
          key={modifyBooking.id}
          booking={modifyBooking}
          pricingRules={pricingRules}
          onClose={() => setModifyBooking(null)}
          onSuccess={() => {
            setModifyBooking(null);
            toast.success(t('modifySuccess'));
            router.refresh();
          }}
        />
      )}

      {cancelModalBooking && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-6 flex flex-col gap-4">
              <h2
                id="cancel-dialog-title"
                className="text-lg font-black text-gray-900"
              >
                {t('cancelDialogTitle')}
              </h2>
              <CancellationPolicy />
            </div>
            <div className="sticky bottom-0 flex gap-3 p-4 border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="btn-ui btn-ui-md btn-ui-ghost flex-1 rounded-2xl"
              >
                {t('modifyCancel')}
              </button>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={async () => {
                  const b = cancelModalBooking;
                  if (!b) return;
                  setCancelSubmitting(true);
                  const { cancelBookingAction } = await import('@/actions/booking');
                  const res = await cancelBookingAction(b.id);
                  setCancelSubmitting(false);
                  if (res.success) {
                    setCancelModalBooking(null);
                    if (res.fullRefund) {
                      toast.success(t('cancelSuccessRefund'));
                    } else {
                      toast.success(t('cancelSuccess'));
                    }
                    router.refresh();
                  } else {
                    const msg = res.error;
                    if (msg?.startsWith('Errors.')) {
                      toast.error(tErr(msg.slice(7) as never));
                    } else {
                      toast.error(msg || t('cancelError'));
                    }
                  }
                }}
                className="btn-ui btn-ui-md btn-ui-danger flex-1 rounded-2xl bg-red-600 text-white hover:bg-red-700"
              >
                {cancelSubmitting ? '…' : t('cancelConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
