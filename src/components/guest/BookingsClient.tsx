"use client";

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Calendar, MapPin, Clock, QrCode } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { moneyToNumber } from '@/lib/money';
import { toast } from 'sonner';
import ReviewForm from './ReviewForm';
import type { GuestBookingListItem } from '@/services/BookingService';

interface BookingsClientProps {
  bookings: GuestBookingListItem[];
}

/**
 * BookingsClient - Client-side animations and list display.
 */
export default function BookingsClient({ bookings }: BookingsClientProps) {
  const t = useTranslations('Guest');
  const locale = useLocale();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-US';
  const router = useRouter();
  const [reviewBooking, setReviewBooking] = useState<GuestBookingListItem | null>(null);

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
      <header className="bg-white p-6 sticky top-0 z-10 border-b border-gray-100">
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
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  booking.status === 'PAID' ? 'bg-green-100 text-green-700' : 
                  booking.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {booking.status}
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
                    ₺{moneyToNumber(booking.totalPrice)}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {(booking.status === 'PAID' || booking.status === 'PENDING') && (
                    <button 
                      onClick={async () => {
                        const refundAmount = Math.max(0, moneyToNumber(booking.totalPrice) - 20);
                        if (confirm(booking.status === 'PAID'
                          ? t('confirmCancelPaid', { amount: refundAmount })
                          : t('confirmCancelPending'))) {
                          const { cancelBookingAction } = await import('@/actions/booking');
                          const res = await cancelBookingAction(booking.id);
                          if (res.success) {
                            toast.success(t('cancelSuccess'));
                            router.refresh();
                          } else {
                            toast.error(res.error || t('cancelError'));
                          }
                        }
                      }}
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
    </div>
  );
}
