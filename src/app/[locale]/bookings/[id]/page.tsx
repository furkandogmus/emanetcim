import { auth } from "@/auth";
import { bookingService } from "@/services/BookingService";
import { notFound, redirect } from "next/navigation";
import { Calendar, Package, MapPin, CheckCircle2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PrintButton from "@/components/guest/PrintButton";
import BookingQrDisplay from "@/components/guest/BookingQrDisplay";
import { moneyToNumber } from "@/lib/money";


/**
 * Booking Detail Page - Rezervasyon Detayı (Server Component)
 * Responsive, minimalist and print-friendly design using plain Tailwind.
 */
export default async function BookingDetailPage({ 
  params 
}: { 
  params: Promise<{ locale: string, id: string }> 
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  const t = await getTranslations("Guest");
  const dateLocale = locale === "tr" ? "tr-TR" : "en-US";

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/bookings/${id}`);
  }

  const booking = await bookingService.getBookingDetails(id);

  const isAdmin = session?.user?.role === 'ADMIN';
  const isOwner = booking?.guestId === session?.user?.id;

  if (!booking || (!isOwner && !isAdmin)) {
    notFound();
  }


  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20 px-6 font-sans">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        
        {/* Success Header */}
        <div className="flex flex-col items-center text-center gap-2 mb-4">
           <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 size={32} />
           </div>
           <h1 className="text-2xl font-black text-gray-900">{t('bookingSuccess')}</h1>
           <p className="text-gray-500 text-sm font-medium px-8">{t('showToPartner')}</p>
        </div>

        {/* QR & ID Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center gap-6">
           <BookingQrDisplay token={booking.qrCodeToken} />
           <div className="text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">{t("bookingCodeLabel")}</p>
              <code className="text-xl font-mono font-black text-orange-600 tracking-widest">{booking.id.slice(0, 8).toUpperCase()}</code>
           </div>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col gap-6">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                 <MapPin size={24} />
              </div>
              <div className="flex-1">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t("depositPointLabel")}</p>
                 <h3 className="font-bold text-gray-900 leading-tight">{booking.shop.name}</h3>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl">
                 <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("checkIn")}</span>
                 </div>
                 <p className="text-sm font-bold text-gray-900">{new Date(booking.checkInTime).toLocaleDateString(dateLocale)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                 <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("checkOut")}</span>
                 </div>
                 <p className="text-sm font-bold text-gray-900">{new Date(booking.checkOutTime).toLocaleDateString(dateLocale)}</p>
              </div>
           </div>

           <div className="flex items-center justify-between p-4 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-100">
              <div className="flex items-center gap-3">
                 <Package size={20} />
                 <span className="font-bold">{booking.bagCountS + booking.bagCountM + booking.bagCountXl} {t("bagsUnit")}</span>
              </div>
              <span className="font-black text-lg">₺{moneyToNumber(booking.totalPrice)}</span>
           </div>
        </div>

        <PrintButton label={t('downloadReceipt')} />
      </div>
    </div>
  );
}


