"use client";

import { useTranslations } from "next-intl";
import { Luggage, Package } from "lucide-react";
import type { PartnerBookingListItem } from "@/services/BookingService";
import { moneyToNumber } from "@/lib/money";
import Money from "@/components/common/Money";

interface PartnerRequestsTabProps {
  bookings: PartnerBookingListItem[];
  dateLocale: string;
  isProcessing: boolean;
  onApprove: (bookingId: string) => void;
  onReject: (bookingId: string) => void;
}

/** Esnaf paneli "talepler" sekmesi: onay bekleyen rezervasyonlar. */
export default function PartnerRequestsTab({
  bookings,
  dateLocale,
  isProcessing,
  onApprove,
  onReject,
}: PartnerRequestsTabProps) {
  const t = useTranslations("Partner");
  return (
    <main className="flex-1 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
       <header className="flex items-center justify-between">
        <h2 className="text-xl font-black tracking-tight uppercase tracking-widest">
          {t("incomingRequests")}
        </h2>
      </header>

      <div className="flex flex-col gap-4 pb-32">
        {bookings.filter(b => (b.status as string) === "WAITING_APPROVAL").length === 0 ? (
           <div className="ui-state ui-state-empty p-12 rounded-[2.5rem] text-center flex flex-col items-center gap-4">
            <Package size={48} strokeWidth={1} />
            <p className="font-bold">{t("noRequestsYet")}</p>
          </div>
        ) : (
          bookings.filter(b => (b.status as string) === "WAITING_APPROVAL").map(booking => (
            <div key={booking.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-orange-100 shadow-xl flex flex-col gap-6">
               <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                      <Luggage size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 tracking-tight">
                        {booking.guest?.name || t("guestFallback", { id: booking.id.slice(0, 4) })}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {new Date(booking.checkInTime).toLocaleDateString(dateLocale)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="text-lg font-black text-gray-900"><Money amount={moneyToNumber(booking.totalPrice)} /></p>
                     <p className="text-[10px] text-gray-400 font-bold uppercase">{booking.bagCountS + booking.bagCountM + booking.bagCountXl} {t("bagCountUnit")}</p>
                  </div>
               </div>
               <div className="flex gap-3">
                  <button 
                    onClick={() => onReject(booking.id)}
                    disabled={isProcessing}
                    className="btn-ui btn-ui-md btn-ui-ghost flex-1 rounded-xl"
                  >
                    {t("reject")}
                  </button>
                  <button 
                     onClick={() => onApprove(booking.id)}
                     disabled={isProcessing}
                     className="btn-ui btn-ui-md btn-ui-primary flex-1 rounded-xl"
                  >
                     {t("approve")}
                  </button>
               </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
