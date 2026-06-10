"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Package,
  X,
  Loader2,
  Settings,
  Home,
  BarChart3,
  Luggage,
} from "lucide-react";

import { Link } from "@/i18n/routing";
import { moneyToNumber } from "@/lib/money";
import { toast } from "sonner";
import QRScanner from "@/components/partner/QRScanner";
import PartnerShopSettingsForm from "@/components/partner/PartnerShopSettingsForm";
import {
  checkInAction,
  checkOutAction,
  getPartnerBookingPreviewAction,
  approveBookingAction,
  rejectBookingAction,
} from "@/actions/partner";
import type { PartnerBookingListItem } from "@/services/BookingService";
import { dateLocaleForUiLocale } from "@/lib/date-locale";



interface PartnerClientProps {
  shopId: string;
  activeCount: number;
  totalEarnings: number;
  /** PLATFORM_COMMISSION_RATE ile uyumlu esnaf payı oranı (örn. 0.5 komisyon → 0.5) */
  merchantShareRatio: number;
  shopName: string;
  initialCapacity: number;
  initialOpening: string;
  initialClosing: string;
  initialPricePerDay: number;
  marketPrice: number;
  bookings: PartnerBookingListItem[];
  initialBookingId?: string;
  initialCheckoutBookingId?: string;
  initialPhone?: string;
}

export default function PartnerClient({
  shopId,
  activeCount,
  totalEarnings,
  merchantShareRatio,
  shopName,
  initialCapacity,
  initialOpening,
  initialClosing,
  initialPricePerDay,
  marketPrice,
  bookings,
  initialBookingId,
  initialCheckoutBookingId,
  initialPhone = "",
}: PartnerClientProps) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const dateLocale = dateLocaleForUiLocale(locale);
  const router = useRouter();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<"PANEL" | "TALEPLER" | "GECMIS" | "AYARLAR">(
    "PANEL"
  );
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{
    id: string;
    guestName: string;
    bags: string;
    bagCountS: number;
    bagCountM: number;
    bagCountXl: number;
    totalBags: number;
  } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [urlHandled, setUrlHandled] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: null | (() => void);
  }>({ open: false, message: "", onConfirm: null });

  const showError = useCallback(
    (message?: string | null) => {
      toast.error(message || t("checkInFailed"));
    },
    [t]
  );

  const askConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmState({ open: true, message, onConfirm });
  }, []);

  const applyPreviewForCheckIn = useCallback(
    async (raw: string, closeScanner: boolean) => {
      setPreviewLoading(true);
      try {
        const preview = await getPartnerBookingPreviewAction(raw);
        if (!preview.success) {
          showError(preview.error);
          return;
        }
        // BookingService.checkIn: PAID veya APPROVED (onay sonrası dükkanda ödeme / QR ile teslim alma)
        if (preview.status !== "PAID" && preview.status !== "APPROVED") {
          showError(t("checkInNotReady", { status: preview.status }));
          return;
        }
        if (closeScanner) setIsScanning(false);
        setScanResult({
          id: preview.bookingId,
          guestName: preview.guestName,
          bags: preview.bagsLabel,
          bagCountS: preview.bagCountS,
          bagCountM: preview.bagCountM,
          bagCountXl: preview.bagCountXl,
          totalBags: preview.totalBags,
        });
      } finally {
        setPreviewLoading(false);
      }
    },
    [showError, t]
  );

  const handleApprove = async (id: string) => {
    setIsProcessing(true);
    const res = await approveBookingAction(id);
    setIsProcessing(false);
    if (res.success) {
      setSuccessBanner(t("approvedSuccess"));
      setTimeout(() => setSuccessBanner(null), 3000);
      router.refresh();
    } else {
      showError(res.error);
    }
  };

  const handleReject = async (id: string) => {
    askConfirm(t("confirmReject"), async () => {
      setIsProcessing(true);
      const res = await rejectBookingAction(id);
      setIsProcessing(false);
      if (res.success) {
        router.refresh();
      } else {
        showError(res.error);
      }
    });
  };



  const executeCheckout = useCallback(
    async (bookingId: string): Promise<boolean> => {
      setCheckingOutId(bookingId);
      try {
        const result = await checkOutAction(bookingId);
        if (result.success) {
          setSuccessBanner(t("checkoutDone"));
          setTimeout(() => setSuccessBanner(null), 3000);
          router.replace(pathname);
          router.refresh();
          return true;
        }
        showError(result.error || t("checkoutFailed"));
        return false;
      } finally {
        setCheckingOutId(null);
      }
    },
    [pathname, router, showError, t]
  );

  const openCheckoutFlow = useCallback(
    async (bookingId: string) => {
      askConfirm(t("confirmCheckout"), async () => {
        await executeCheckout(bookingId);
      });
    },
    [askConfirm, executeCheckout, t]
  );



  const runCheckoutFromUrl = useCallback(
    async (bookingId: string) => {
      setPreviewLoading(true);
      try {
        const preview = await getPartnerBookingPreviewAction(bookingId);
        if (!preview.success) {
          showError(preview.error);
          return;
        }
        if (preview.status !== "CHECKED_IN") {
          showError(t("checkoutNotReady", { status: preview.status }));
          return;
        }
        await openCheckoutFlow(bookingId);
      } finally {
        setPreviewLoading(false);
      }
    },
    [openCheckoutFlow, showError, t]
  );

  useEffect(() => {
    if (urlHandled) return;
    if (initialCheckoutBookingId) {
      setUrlHandled(true);
      setActiveTab("GECMIS");
      void runCheckoutFromUrl(initialCheckoutBookingId);
      return;
    }
    if (initialBookingId) {
      setUrlHandled(true);
      setActiveTab("PANEL");
      void applyPreviewForCheckIn(initialBookingId, false);
    }
  }, [
    initialBookingId,
    initialCheckoutBookingId,
    urlHandled,
    applyPreviewForCheckIn,
    runCheckoutFromUrl,
  ]);



  const handleScanResult = (result: string) => {
    void applyPreviewForCheckIn(result, true);
  };

  const handleCheckIn = async () => {
    if (!scanResult) return;
    setIsProcessing(true);
    const result = await checkInAction(scanResult.id);
    setIsProcessing(false);

    if (result.success) {
      setSuccessBanner(t("checkInSuccess"));
      setScanResult(null);
      setTimeout(() => setSuccessBanner(null), 3000);
      router.refresh();
    } else {
      showError(result.error || t("checkInFailed"));
    }
  };

  const handleCheckoutFromList = (bookingId: string) => {
    void openCheckoutFlow(bookingId);
  };

  const netEarnings =
    Math.round(totalEarnings * merchantShareRatio * 100) / 100;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 p-6 md:p-12 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-80 h-80 bg-orange-100/30 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

      {isScanning && (
        <QRScanner
          onResult={handleScanResult}
          onClose={() => setIsScanning(false)}
        />
      )}

      {previewLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader2 className="animate-spin text-white w-12 h-12" />
        </div>
      )}

      {scanResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 text-white animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white text-gray-900 rounded-[2.5rem] w-full max-w-lg p-10 flex flex-col gap-8 shadow-2xl relative border border-gray-100 my-8">
            <button
              type="button"
              onClick={() => setScanResult(null)}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X size={20} />
            </button>

                <div className="flex items-center gap-6">
                  <div className="rounded-[2rem] bg-orange-100 p-5 text-orange-600 ring-4 ring-orange-50 shadow-inner">
                    <Package size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter">
                      {scanResult.guestName}
                    </h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      {scanResult.bags}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCheckIn()}
                  disabled={isProcessing}
                  className={`flex h-20 w-full items-center justify-center gap-3 rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${
                    !isProcessing
                      ? "bg-orange-600 text-white shadow-orange-200/50 hover:bg-orange-700"
                      : "cursor-not-allowed bg-gray-100 text-gray-300 grayscale"
                  }`}
                >
                  {isProcessing ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={24} />
                  )}
                  {t("sealAndStart")}
                </button>
          </div>
        </div>
      )}

      {confirmState.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="ui-card w-full max-w-sm p-6 flex flex-col gap-4">
            <p className="text-sm font-semibold text-gray-700 leading-relaxed">{confirmState.message}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmState({ open: false, message: "", onConfirm: null })}
                className="btn-ui btn-ui-md btn-ui-ghost flex-1"
              >
                {t("checkoutCancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmState.onConfirm;
                  setConfirmState({ open: false, message: "", onConfirm: null });
                  if (fn) void fn();
                }}
                className="btn-ui btn-ui-md btn-ui-primary flex-1"
              >
                {t("approve")}
              </button>
            </div>
          </div>
        </div>
      )}

      {successBanner && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-10">
          <CheckCircle2 size={24} className="animate-bounce" />
          <span className="font-black tracking-tight">{successBanner}</span>
        </div>
      )}

      <header className="flex justify-between items-start mb-12 gap-4">
        <div>
          <h1
            className="text-3xl font-black tracking-tighter text-gray-900 border-b-4 border-orange-500 pb-1 inline-block capitalize"
            data-testid="partner-shop-name"
          >
            {shopName.toLowerCase()}
          </h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-3">
            {t("partnerPanelActive")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 pt-2">
          <Link
            href="/partner/earnings"
            className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-700 whitespace-nowrap"
          >
            {t("earnings")}
          </Link>
          <Link
            href="/partner/bookings"
            className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-700 whitespace-nowrap"
          >
            {t("listCalendar")}
          </Link>
          <Link
            href="/partner/seals"
            className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-700 whitespace-nowrap"
          >
            {t("sealsTitle")}
          </Link>
        </div>
      </header>

      {activeTab === "PANEL" && (
        <main className="flex-1 flex flex-col items-center justify-center gap-16 animate-in fade-in duration-500">
          <button
            type="button"
            onClick={() => setIsScanning(true)}
            className="w-full max-w-sm aspect-square bg-gray-900 hover:bg-black active:scale-95 text-white rounded-[4rem] shadow-2xl flex flex-col items-center justify-center gap-8 transition-all group overflow-hidden"
          >
            <div className="bg-white/10 p-8 rounded-full group-hover:scale-110 transition-transform">
              <Camera size={72} strokeWidth={1} />
            </div>
            <span className="text-2xl font-black tracking-tight px-8 text-center leading-tight">
              {t("newBagDropoff")}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col gap-1">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                {t("activeBookings")}
              </p>
              <p className="text-4xl font-black text-gray-900">{activeCount}</p>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col gap-1">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                {t("netEarnings")}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-green-600">
                  {netEarnings}
                </span>
                <span className="text-xs font-black text-green-600/60 uppercase">
                  TL
                </span>
              </div>
            </div>
          </div>
        </main>
      )}

      {activeTab === "GECMIS" && (
        <main className="flex-1 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight uppercase tracking-widest">
              {t("transactionHistory")}
            </h2>
            <div className="px-4 py-2 bg-orange-100 text-orange-600 rounded-2xl text-[10px] font-black uppercase">
              {t("transactionsCount", { count: bookings.length })}
            </div>
          </header>

          <div className="flex flex-col gap-4 pb-32">
            {bookings.length === 0 ? (
              <div className="ui-state ui-state-empty p-12 rounded-[2.5rem] text-center flex flex-col items-center gap-4">
                <Package size={48} strokeWidth={1} />
                <p className="font-bold">{t("noTransactionsYet")}</p>
              </div>
            ) : (
              [...bookings]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col gap-6 hover:translate-y-[-4px] transition-all group overflow-hidden relative"
                  >
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-orange-600 group-hover:text-white transition-all">
                          <Luggage size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-gray-900 tracking-tight">
                            {booking.guest?.name ||
                              t("guestFallback", { id: booking.id.slice(0, 4) })}
                          </h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {new Date(booking.checkInTime).toLocaleDateString(
                              dateLocale
                            )}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                          booking.status === "CHECKED_OUT"
                            ? "bg-green-100 text-green-600"
                            : booking.status === "CANCELLED"
                              ? "bg-red-100 text-red-600"
                              : booking.status === "CHECKED_IN"
                                ? "bg-blue-100 text-blue-600"
                                : "bg-orange-50 text-orange-500"
                        }`}
                      >
                        {(booking.status as string) === "CHECKED_OUT" && t("statusCheckedOut")}
                        {(booking.status as string) === "CANCELLED" && t("statusCancelled")}
                        {(booking.status as string) === "CHECKED_IN" && t("statusCheckedIn")}
                        {(booking.status as string) === "PAID" && t("statusPaid")}
                        {(booking.status as string) === "PENDING" && t("statusPending")}
                        {!["CHECKED_OUT", "CANCELLED", "CHECKED_IN", "PAID", "PENDING"].includes(booking.status as string) && booking.status}
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-50 pt-6">
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {t("netEarningsShort")}
                        </p>
                        <p className="font-black text-xl text-gray-900">
                          {(booking.status as string) === "CANCELLED"
                            ? "0"
                            : Math.round(
                                moneyToNumber(booking.totalPrice) *
                                  merchantShareRatio *
                                  100
                              ) / 100}
                          <span className="text-[10px] ml-1 opacity-40 uppercase">
                            TL
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {t("bagLabel")}
                        </p>
                        <p className="font-black text-gray-900 tracking-tight">
                          {booking.bagCountS + booking.bagCountM + booking.bagCountXl}{" "}
                          {t("bagCountUnit")}
                        </p>
                      </div>
                    </div>

                    {(booking.status as string) === "CHECKED_IN" && (
                      <button
                        type="button"
                        disabled={checkingOutId === booking.id}
                        onClick={() => void handleCheckoutFromList(booking.id)}
                        className="btn-ui btn-ui-lg btn-ui-primary w-full rounded-2xl bg-gray-900 hover:bg-black"
                      >
                        {checkingOutId === booking.id ? (
                          <Loader2 className="inline animate-spin w-5 h-5" />
                        ) : (
                          t("deliveryCheckoutShort")
                        )}
                      </button>
                    )}

                    <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-bl-[4rem] -z-0 translate-x-8 -translate-y-8 opacity-0 group-hover:opacity-100 transition-all"></div>
                  </div>
                ))
            )}
          </div>
        </main>
      )}

      {activeTab === "TALEPLER" && (
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
                            {booking.guest?.name || "Misafir"}
                          </h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {new Date(booking.checkInTime).toLocaleDateString(dateLocale)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-lg font-black text-gray-900">₺{moneyToNumber(booking.totalPrice)}</p>
                         <p className="text-[10px] text-gray-400 font-bold uppercase">{booking.bagCountS + booking.bagCountM + booking.bagCountXl} {t("bagCountUnit")}</p>
                      </div>
                   </div>
                   <div className="flex gap-3">
                      <button 
                        onClick={() => handleReject(booking.id)}
                        disabled={isProcessing}
                        className="btn-ui btn-ui-md btn-ui-ghost flex-1 rounded-xl"
                      >
                        {t("reject")}
                      </button>
                      <button 
                         onClick={() => handleApprove(booking.id)}
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
      )}

      {activeTab === "AYARLAR" && (
        <main className="flex-1 max-w-md mx-auto w-full flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
          <PartnerShopSettingsForm
            shopId={shopId}
            initialCapacity={initialCapacity}
            initialOpening={initialOpening}
            initialClosing={initialClosing}
            initialPricePerDay={initialPricePerDay}
            marketPrice={marketPrice}
            initialPhone={initialPhone}
            compact
          />
        </main>
      )}

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-2xl border border-gray-100 px-8 py-4 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex gap-12 z-20">
        <button
          type="button"
          onClick={() => setActiveTab("PANEL")}
          className={`p-3 rounded-2xl transition-all ${activeTab === "PANEL" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Home size={24} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("TALEPLER")}
          className={`p-3 rounded-2xl transition-all relative ${activeTab === "TALEPLER" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Luggage size={24} />
          {bookings.filter(b => (b.status as string) === "WAITING_APPROVAL").length > 0 && (
            <span className="absolute top-2 right-2 w-3 h-3 bg-red-600 rounded-full border-2 border-white"></span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("GECMIS")}
          className={`p-3 rounded-2xl transition-all ${activeTab === "GECMIS" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <BarChart3 size={24} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("AYARLAR")}
          className={`p-3 rounded-2xl transition-all ${activeTab === "AYARLAR" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Settings size={24} />
        </button>
      </nav>
    </div>
  );
}
