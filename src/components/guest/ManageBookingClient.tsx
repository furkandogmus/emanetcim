"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { MapPin, Calendar, Clock, Package, Shield, XCircle } from "lucide-react";

interface BookingInfo {
  id: string;
  shopName: string;
  shopAddress: string;
  checkInTime: string;
  checkOutTime: string;
  totalPrice: number;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  status: string;
  qrCodeToken: string | null;
}

export default function ManageBookingClient({ initialToken }: { initialToken: string }) {
  const t = useTranslations("Guest");
  const router = useRouter();
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [token] = useState(initialToken);

  useEffect(() => {
    fetch(`/api/bookings/lookup/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => {
      if (d.ok) setBooking(d.booking);
      else toast.error(t("bookingLookupError"));
    }).catch(() => toast.error(t("bookingLookupError")))
    .finally(() => setLoading(false));
  }, [token, t]);

  const handleCancel = async () => {
    if (!confirm(t("confirmCancel"))) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/bookings/guest-cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setCancelled(true);
        toast.success(t("cancelSuccess"));
      } else {
        toast.error(data.error || t("cancelError"));
      }
    } catch {
      toast.error(t("cancelError"));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <XCircle size={48} className="text-gray-300 mb-4" />
        <h1 className="text-xl font-black text-gray-900">{t("bookingNotFound")}</h1>
        <p className="text-sm text-gray-500 mt-2">{t("bookingLookupError")}</p>
        <Link href="/search" className="mt-6 btn-ui btn-ui-primary rounded-2xl px-6 py-3">
          {t("searchPlaceholder")}
        </Link>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <Shield size={32} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-black text-gray-900">{t("cancelSuccess")}</h1>
        <p className="text-sm text-gray-500 mt-2">{t("cancelSuccessRefund")}</p>
        <Link href="/search" className="mt-6 btn-ui btn-ui-primary rounded-2xl px-6 py-3">
          {t("searchPlaceholder")}
        </Link>
      </div>
    );
  }

  const canCancel = ["PENDING", "APPROVED", "PAID", "WAITING_APPROVAL"].includes(booking.status);
  const totalBags = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  const checkIn = new Date(booking.checkInTime);
  const checkOut = new Date(booking.checkOutTime);
  const hours = Math.round((checkOut.getTime() - checkIn.getTime()) / 3600000 * 10) / 10;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h1 className="text-lg font-black text-gray-900 mb-4">
              {t("manageBookingTitle")}
            </h1>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                <MapPin size={24} className="text-orange-600" />
              </div>
              <div>
                <p className="font-black text-gray-900">{booking.shopName}</p>
                <p className="text-xs text-gray-500">{booking.shopAddress}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase">{t("status")}</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-orange-50 text-orange-600">
                  {booking.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Calendar size={12} /> {t("checkIn")}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {checkIn.toLocaleDateString()} {String(checkIn.getHours()).padStart(2, "0")}:{String(checkIn.getMinutes()).padStart(2, "0")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Calendar size={12} /> {t("checkOut")}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {checkOut.toLocaleDateString()} {String(checkOut.getHours()).padStart(2, "0")}:{String(checkOut.getMinutes()).padStart(2, "0")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Clock size={12} /> {t("duration")}
                </span>
                <span className="text-sm font-bold text-gray-900">{hours}h</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Package size={12} /> {t("bags")}
                </span>
                <span className="text-sm font-bold text-gray-900">{totalBags}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400 font-bold uppercase">{t("total")}</span>
                <span className="text-lg font-black text-gray-900">₺{booking.totalPrice}</span>
              </div>
            </div>

            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-6 w-full py-4 rounded-2xl bg-red-500 text-white font-black uppercase tracking-widest text-sm disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {cancelling ? "..." : t("confirmCancel")}
              </button>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">
            {t("manageBookingFooter")}{" "}
            <Link href="/search" className="text-orange-600 font-bold underline">
              {t("searchPlaceholder")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
