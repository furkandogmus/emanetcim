"use client";

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Calendar, MapPin, Clock, QrCode } from 'lucide-react';
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

interface BookingsClientProps {
  bookings: GuestBookingListItem[];
  pricingRules: PricingRules;
  /** iyzico veya Stripe ile /bookings/[id]/pay açıksa onay sonrası ödeme linki. */
  onlinePayEnabled?: boolean;
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
  onlinePayEnabled = false,
}: BookingsClientProps) {
  const t = useTranslations('Guest');
  const tErr = useTranslations('Errors');
  const locale = useLocale();
  const dateLocale = dateLocaleForUiLocale(locale);
  const router = useRouter();
  const [reviewBooking, setReviewBooking] = useState<GuestBookingListItem | null>(null);
  const [modifyBooking, setModifyBooking] = useState<GuestBookingListItem | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<GuestBookingListItem | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

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
          className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 active:scale-95 transition-all"
        >
          {t('exploreShops')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white p-6">
        <Link
          href="/search"
          className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-orange-600"
          aria-label={t('findShops')}
        >
          <MapPin size={22} aria-hidden />
        </Link>
        <h1 className="text-2xl font-black text-gray-900">{t('myBookings')}</h1>
      </header>

      <main className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
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
                  {onlinePayEnabled &&
                    (booking.status === "APPROVED" || booking.status === "PENDING") && (
                      <Link
                        href={`/bookings/${booking.id}/pay`}
                        className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-orange-600 text-white hover:bg-orange-700 transition-colors shadow-md shadow-orange-200"
                      >
                        {t("payBookingOpenCta")}
                      </Link>
                    )}
                  {canGuestModifyBooking(booking.status) && (
                    <button
                      type="button"
                      onClick={() => setModifyBooking(booking)}
                      className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
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
                      className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors border border-red-100"
                    >
                      {t('cancelBooking')}
                    </button>
                  )}

                  {booking.status === 'CHECKED_OUT' && (
                    <button 
                      onClick={() => setReviewBooking(booking)}
                      className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-orange-600 hover:bg-orange-50 transition-colors border border-orange-100"
                    >
                      {t('evaluate')}
                    </button>
                  )}

                  {booking.status === 'CHECKED_OUT' && !booking.dispute && (
                    <Link
                      href={`/bookings/${booking.id}/dispute`}
                      className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-100 border border-gray-200"
                    >
                      {t('complaint')}
                    </Link>
                  )}
                  
                  {booking.status !== 'CANCELLED' && (
                    <Link 
                      href={`/bookings/${booking.id}`}
                      className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95"
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
          guestId={reviewBooking.guestId}
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
              <CancellationPolicy
                checkInTime={cancelModalBooking.checkInTime}
                showRefundEstimate={cancelModalBooking.status === 'PAID'}
                totalPaidTry={moneyToNumber(cancelModalBooking.totalPrice)}
              />
            </div>
            <div className="sticky bottom-0 flex gap-3 p-4 border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider bg-gray-100 text-gray-800"
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
                    if (res.creditCode) {
                      toast.success(
                        t('cancelSuccessCredit', { code: res.creditCode })
                      );
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
                className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider bg-red-600 text-white disabled:opacity-50"
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
