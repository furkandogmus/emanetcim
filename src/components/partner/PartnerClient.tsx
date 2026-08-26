"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Calendar,
  ShieldCheck,
} from "lucide-react";

import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import PartnerShopSettingsForm from "@/components/partner/PartnerShopSettingsForm";
import CheckInDialog, { type CheckInPreview } from "@/components/partner/CheckInDialog";
import CheckoutSealsDialog, { type CheckoutSeal } from "@/components/partner/CheckoutSealsDialog";
import PartnerHistoryTab from "@/components/partner/PartnerHistoryTab";
import PartnerRequestsTab from "@/components/partner/PartnerRequestsTab";
import PartnerBottomNav, { type PartnerTab } from "@/components/partner/PartnerBottomNav";
import PartnerReferralCard from "@/components/partner/PartnerReferralCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import {
  checkOutAction,
  getPartnerBookingPreviewAction,
  getPartnerBookingSealsAction,
  approveBookingAction,
  rejectBookingAction,
} from "@/actions/partner";
import type { PartnerBookingListItem } from "@/services/BookingService";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { computeOverdue } from "@/lib/overdue-display";
import { useActionErrorText } from "@/lib/use-action-error";

/**
 * QR tarayıcı AYRI BİR PARÇAYA alındı (performans).
 *
 * `html5-qrcode` derlenmiş hâlde ~400 KB ve yalnızca esnaf "QR tara"ya
 * BASTIĞINDA (`isScanning`) çiziliyor. Statik `import` ile bu 400 KB, tarayıcı
 * hiç açılmasa bile partner panelinin her açılışında iniyordu — panel esnafın
 * gün boyu en çok açtığı sayfa ve çoğu zaman mobil veriyle açılıyor.
 *
 * `ssr: false`: bileşen kamera API'sine bağlı, sunucuda çizilebilecek bir
 * karşılığı yok.
 */
const QRScanner = dynamic(() => import("@/components/partner/QRScanner"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <Loader2 className="animate-spin text-white w-12 h-12" />
    </div>
  ),
});



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
  /**
   * `PlatformSettings.requireSealsOnCheckIn`. Açıkken sunucu mühürsüz check-in'i
   * reddeder; ekranın da bunu ÖNCEDEN söylemesi gerekir, yoksa esnaf butona
   * basıp anlaşılmaz bir hata görür (P1-23).
   */
  requireSeals?: boolean;
  /** `AnalyticsService.getShopViewCountThisMonth` — bu ay kaç kez görüntülendi. */
  monthlyShopViews?: number;
  /**
   * Esnafın TÜM dükkanları. Panel eskiden koşulsuz `shops[0]`'ı gösteriyordu:
   * çok dükkanlı esnafın ikinci dükkanındaki valizler "İşlem Geçmişi"nde hiç
   * görünmüyordu. Check-in `?booking=`/QR ile sahiplik üzerinden çalıştığı için
   * valiz ALINIYOR ama listede bulunamıyor → teslim edilemiyordu.
   */
  shops?: Array<{ id: string; name: string }>;
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
  shops = [],
  initialBookingId,
  initialCheckoutBookingId,
  initialPhone = "",
  requireSeals = false,
  monthlyShopViews = 0,
}: PartnerClientProps) {
  const t = useTranslations("Partner");
  const errorText = useActionErrorText();
  const tCommon = useTranslations("Common");
  /**
   * Gecikme hesabı için TEK referans an.
   *
   * Her çağrıda `new Date()` kullanmak React Compiler'ın saflık kuralını ihlal
   * eder ve aynı listede satırdan satıra farklı "şimdi" değeri üretir.
   *
   * NEDEN `useState(() => new Date())` DEĞİL (P1-15, React #418 — DEFECT_BACKLOG):
   * o başlangıç değeri sunucuda VE istemcinin hydration render'ında AYRI AYRI
   * hesaplanır — ikisi arasındaki fark (ağ gecikmesi + JS ayrıştırma) genellikle
   * saniyelerle ölçülür. Bir rezervasyonun çıkış saati tam bu aralıkta bir saat
   * sınırını geçerse `overdueOf(...).overdueHours` sunucuda "3", istemcide "4"
   * basar — metin içeriği uyuşmaz, React o alt ağacı sıfırdan render eder
   * (titreme, ilk tıklamanın kaybolması). `null` ile başlatılıp `useEffect`'te
   * gerçek an atanıyor: sunucu ve ilk istemci render'ı HER ZAMAN aynı ("nötr")
   * sonucu üretir, gerçek gecikme durumu mount SONRASI (karşılaştırma dışı) gelir.
   */
  const [nowRef, setNowRef] = useState<Date | null>(null);
  useEffect(() => {
    setNowRef(new Date());
  }, []);
  const overdueOf = useCallback(
    (checkOutTime: string | Date) =>
      nowRef
        ? computeOverdue(checkOutTime, nowRef)
        : { severity: "none" as const, overdueHours: 0, overdueDays: 0 },
    [nowRef],
  );
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
  const router = useRouter();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<PartnerTab>("PANEL");
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<CheckInPreview | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [checkoutSeals, setCheckoutSeals] = useState<{
    bookingId: string;
    seals: CheckoutSeal[];
  } | null>(null);
  const [urlHandled, setUrlHandled] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: null | (() => void);
  }>({ open: false, message: "", onConfirm: null });

  const closeScanResult = useCallback(() => setScanResult(null), []);
  const closeCheckoutSeals = useCallback(() => setCheckoutSeals(null), []);
  const closeConfirm = useCallback(
    () => setConfirmState({ open: false, message: "", onConfirm: null }),
    [],
  );

  /*
    Gelen deger bir `Errors.*` ANAHTARI ya da servisin Turkce cumlesiydi; ikisi de
    ekrana aynen basiliyordu (2026-08-25). Artik once anahtara indirgenip
    cevriliyor, taninmayan her sey yerellestirilmis yedek metne dusuyor.
  */
  const showError = useCallback(
    (message?: string | null) => {
      toast.error(errorText(message, t("checkInFailed")));
    },
    [errorText, t]
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
    /*
      Ne action ne de bu handler try/catch icermiyordu -- beklenmeyen bir
      hata (DB baglanti sorunu vb.) firlarsa setIsProcessing hic sifirlanmiyor,
      buton SONSUZA dek "isleniyor" durumunda kaliyordu.
    */
    try {
      const res = await approveBookingAction(id);
      if (res.success) {
        setSuccessBanner(t("approvedSuccess"));
        setTimeout(() => setSuccessBanner(null), 3000);
        router.refresh();
      } else {
        showError(res.error);
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : undefined);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    askConfirm(t("confirmReject"), async () => {
      setIsProcessing(true);
      try {
        const res = await rejectBookingAction(id);
        if (res.success) {
          router.refresh();
        } else {
          showError(res.error);
        }
      } catch (e) {
        showError(e instanceof Error ? e.message : undefined);
      } finally {
        setIsProcessing(false);
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
      } catch (e) {
        // checkOutAction icinde assertPartner() try/catch disinda -- teslim
        // sirasinda oturum sona ererse hala firlar. finally checkingOutId'yi
        // zaten sifirliyordu ama hicbir hata gorulmuyordu.
        showError(e instanceof Error ? e.message : undefined);
        return false;
      } finally {
        setCheckingOutId(null);
      }
    },
    [pathname, router, showError, t]
  );

  const openCheckoutFlow = useCallback(
    async (bookingId: string) => {
      /**
       * Mühür varsa TEK TEK onaylatılır; yoksa (eski kayıtlar, mühürsüz
       * dönemde alınan valizler) eski genel onay penceresine düşülür —
       * mühürsüz bir rezervasyonu onaylanacak mühür yok diye kilitlemek
       * teslimi imkânsız kılardı.
       */
      const res = await getPartnerBookingSealsAction(bookingId);
      if (res.success && res.seals.length > 0) {
        setCheckoutSeals({ bookingId, seals: res.seals });
        return;
      }
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

  const handleCheckInSuccess = () => {
    setSuccessBanner(t("checkInSuccess"));
    setScanResult(null);
    setTimeout(() => setSuccessBanner(null), 3000);
    router.refresh();
  };

  const handleCheckoutFromList = (bookingId: string) => {
    void openCheckoutFlow(bookingId);
  };

  const netEarnings =
    Math.round(totalEarnings * merchantShareRatio * 100) / 100;

  return (
    <div className="relative flex flex-col overflow-hidden bg-gray-50 px-4 pb-32 pt-6 font-sans text-gray-900 sm:px-6 md:p-12 md:pb-36">
      <div className="absolute top-0 right-0 w-80 h-80 bg-orange-100/30 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

      {isScanning && (
        <QRScanner
          onResult={handleScanResult}
          onClose={() => setIsScanning(false)}
        />
      )}

      {previewLoading && (
        <div
          role="status"
          aria-live="polite"
          aria-label={tCommon("loading")}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <Loader2 className="animate-spin text-white w-12 h-12" />
        </div>
      )}

      {scanResult && (
        <CheckInDialog
          preview={scanResult}
          shopId={shopId}
          requireSeals={requireSeals}
          onClose={closeScanResult}
          onSuccess={handleCheckInSuccess}
        />
      )}

      {checkoutSeals && (
        <CheckoutSealsDialog
          bookingId={checkoutSeals.bookingId}
          seals={checkoutSeals.seals}
          busy={checkingOutId === checkoutSeals.bookingId}
          onClose={closeCheckoutSeals}
          onConfirm={(id) => {
            setCheckoutSeals(null);
            void executeCheckout(id);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmState.open}
        message={confirmState.message}
        confirmLabel={t("approve")}
        cancelLabel={t("checkoutCancel")}
        onCancel={closeConfirm}
        onConfirm={() => {
          const fn = confirmState.onConfirm;
          closeConfirm();
          if (fn) void fn();
        }}
      />

      {successBanner && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-10">
          <CheckCircle2 size={24} className="animate-bounce" />
          <span className="font-black tracking-tight">{successBanner}</span>
        </div>
      )}

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between md:mb-12">
        <div>
          <h1
            className="text-3xl font-black tracking-tighter text-gray-900 border-b-4 border-orange-500 pb-1 inline-block capitalize"
            data-testid="partner-shop-name"
          >
            {shopName.toLowerCase()}
          </h1>
          <p className="text-xs text-gray-400 id-eyebrow mt-3">
            {t("partnerPanelActive")}
          </p>
          {shops.length > 1 && (
            <div className="mt-3">
              <label
                htmlFor="partner-shop-switcher"
                className="block id-eyebrow text-gray-400"
              >
                {t("shopSwitcherLabel")}
              </label>
              <select
                id="partner-shop-switcher"
                data-testid="partner-shop-switcher"
                value={shopId}
                onChange={(e) => {
                  const next = new URLSearchParams();
                  next.set("shop", e.target.value);
                  router.push(`${pathname}?${next.toString()}`);
                }}
                className="mt-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 cursor-pointer"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-col">
          <Link
            href="/partner/earnings"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-orange-50 px-2 py-2.5 text-center text-[10px] font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-[0.97] sm:flex-row sm:gap-3 sm:px-4 sm:text-sm"
          >
            <TrendingUp size={18} />
            {t("earnings")}
          </Link>
          <Link
            href="/partner/bookings"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-orange-50 px-2 py-2.5 text-center text-[10px] font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-[0.97] sm:flex-row sm:gap-3 sm:px-4 sm:text-sm"
          >
            <Calendar size={18} />
            {t("listCalendar")}
          </Link>
          <Link
            href="/partner/seals"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-orange-50 px-2 py-2.5 text-center text-[10px] font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-[0.97] sm:flex-row sm:gap-3 sm:px-4 sm:text-sm"
          >
            <ShieldCheck size={18} />
            {t("sealsTitle")}
          </Link>
        </div>
      </header>

      {activeTab === "PANEL" && (
        <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-6 animate-in fade-in duration-500 md:grid-cols-[minmax(260px,0.9fr)_minmax(320px,1.1fr)] md:gap-10">
          <button
            type="button"
            onClick={() => setIsScanning(true)}
            className="group mx-auto flex aspect-square w-full max-w-[280px] flex-col items-center justify-center gap-5 overflow-hidden rounded-4xl bg-brand-gradient text-white shadow-brand-xl transition-all hover:brightness-105 active:scale-95 sm:max-w-xs md:max-w-sm md:gap-8 md:rounded-4xl"
          >
            <div className="bg-white/10 p-8 rounded-full group-hover:scale-110 transition-transform">
              <Camera size={64} strokeWidth={1} />
            </div>
            <span className="text-2xl font-black tracking-tight px-8 text-center leading-tight">
              {t("newBagDropoff")}
            </span>
          </button>

          <div className="grid w-full grid-cols-2 gap-3 md:gap-6">
            <div className="ui-card flex flex-col gap-1 p-5 md:rounded-4xl md:p-6">
              <p className="id-eyebrow text-gray-400">
                {t("activeBookings")}
              </p>
              <p className="text-3xl font-black text-gray-900 md:text-4xl">{activeCount}</p>
            </div>
            <div className="ui-card flex flex-col gap-1 p-5 md:rounded-4xl md:p-6">
              <p className="id-eyebrow text-gray-400">
                {t("netEarnings")}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-green-600 md:text-4xl">
                  {netEarnings}
                </span>
                <span className="text-xs font-black text-green-600/60 uppercase">
                  TL
                </span>
              </div>
            </div>
            <div className="ui-card col-span-2 flex items-center justify-between gap-2 p-5 md:rounded-4xl md:p-6">
              <p className="id-eyebrow text-gray-400">
                {t("monthlyShopViews")}
              </p>
              <p className="text-2xl font-black text-gray-900 md:text-3xl">
                {monthlyShopViews}
              </p>
            </div>
            <div className="col-span-2">
              <PartnerReferralCard />
            </div>
          </div>
        </main>
      )}

      {activeTab === "GECMIS" && (
        <PartnerHistoryTab
          bookings={bookings}
          merchantShareRatio={merchantShareRatio}
          dateLocale={dateLocale}
          overdueOf={overdueOf}
          checkingOutId={checkingOutId}
          onCheckout={handleCheckoutFromList}
        />
      )}

      {activeTab === "TALEPLER" && (
        <PartnerRequestsTab
          bookings={bookings}
          dateLocale={dateLocale}
          isProcessing={isProcessing}
          onApprove={(id) => void handleApprove(id)}
          onReject={(id) => void handleReject(id)}
        />
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

      <PartnerBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        pendingCount={bookings.filter((b) => (b.status as string) === "WAITING_APPROVAL").length}
      />
    </div>
  );
}
