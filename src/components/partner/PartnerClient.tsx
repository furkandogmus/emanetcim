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
  TrendingUp,
  Calendar,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { Link } from "@/i18n/routing";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";
import { moneyToNumber } from "@/lib/money";
import { toast } from "sonner";
import QRScanner from "@/components/partner/QRScanner";
import PartnerShopSettingsForm from "@/components/partner/PartnerShopSettingsForm";
import {
  checkInAction,
  checkOutAction,
  getPartnerBookingPreviewAction,
  getNextAvailableSealsAction,
  getPartnerBookingSealsAction,
  approveBookingAction,
  rejectBookingAction,
} from "@/actions/partner";
import type { PartnerBookingListItem } from "@/services/BookingService";
import { dateLocaleForUiLocale } from "@/lib/date-locale";
import Money from "@/components/common/Money";
import { computeOverdue } from "@/lib/overdue-display";



type BagSize = "S" | "M" | "XL";

type SealRow = {
  bagIndex: number;
  bagSize: BagSize;
  /** Serbest metin: esnaf elle de yazabilir, bu yüzden `number` DEĞİL. */
  sealNumber: string;
};

/**
 * Valizleri `BookingSeal.bagIndex` ile aynı sırada dizer: önce S, sonra M, sonra XL.
 * Sıra sabit olmak ZORUNDA — `@@unique([bookingId, bagIndex])` var ve check-out
 * ekranı valizi bu indeksle eşleştiriyor.
 */
function buildSealRows(s: number, m: number, xl: number): SealRow[] {
  const rows: SealRow[] = [];
  let index = 0;
  for (let i = 0; i < s; i++) rows.push({ bagIndex: index++, bagSize: "S", sealNumber: "" });
  for (let i = 0; i < m; i++) rows.push({ bagIndex: index++, bagSize: "M", sealNumber: "" });
  for (let i = 0; i < xl; i++) rows.push({ bagIndex: index++, bagSize: "XL", sealNumber: "" });
  return rows;
}

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
  requireSeals = false,
}: PartnerClientProps) {
  const t = useTranslations("Partner");
  /**
   * Gecikme hesabı için TEK referans an.
   *
   * Her çağrıda `new Date()` kullanmak React Compiler'ın saflık kuralını ihlal
   * eder ve aynı listede satırdan satıra farklı "şimdi" değeri üretir.
   */
  const [nowRef] = useState(() => new Date());
  const overdueOf = useCallback(
    (checkOutTime: string | Date) => computeOverdue(checkOutTime, nowRef),
    [nowRef],
  );
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
  const [sealRows, setSealRows] = useState<SealRow[]>([]);
  /**
   * Stoktan çıkan ama fiziksel olarak bozuk mühürler. Atamalardan AYRI tutulur:
   * sunucu bunları `FAULTY` yapar ve aynı numaranın hem atanmış hem bozuk
   * gelmesini `faulty_overlaps_assignment` ile reddeder.
   */
  const [faultySeals, setFaultySeals] = useState<number[]>([]);
  const [sealsLoading, setSealsLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  /**
   * Teslim onayı: check-in'de kaydedilen mühürler tek tek işaretlenir.
   *
   * Mührün kanıt zinciri iki uçludur — giriş kaydı tek başına yarım. Esnaf
   * hangi mührü geri verdiğini görmeden "teslim ettim" derse, çıkışta mührün
   * sağlam olup olmadığı hiçbir yerde teyit edilmemiş olur.
   */
  const [checkoutSeals, setCheckoutSeals] = useState<{
    bookingId: string;
    seals: { sealNumber: number; bagIndex: number; bagSize: string }[];
    confirmed: number[];
  } | null>(null);
  const [urlHandled, setUrlHandled] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: null | (() => void);
  }>({ open: false, message: "", onConfirm: null });

  /**
   * Bu ekrandaki modallar Escape ile KAPANMIYORDU ve `role="dialog"` taşımıyordu.
   *
   * 2026-08-22 erişilebilirlik düzeltmesi `ConfirmDialog`'u kapsamıştı; esnaf
   * paneli kendi modallarını elle çizdiği için o düzeltmenin dışında kalmıştı —
   * yani klavye kullanıcısı check-in kutusunun içinde kilitli kalıyordu.
   * Davranış `useModalBehavior` ile tek yerden gelir: Escape, arka plan kaydırma
   * kilidi, odağın geri verilmesi.
   */
  const closeScanResult = useCallback(() => {
    setScanResult(null);
    setSealRows([]);
    setFaultySeals([]);
  }, []);
  const closeCheckoutSeals = useCallback(() => setCheckoutSeals(null), []);
  const closeConfirm = useCallback(
    () => setConfirmState({ open: false, message: "", onConfirm: null }),
    [],
  );

  useModalBehavior({ open: scanResult !== null, onClose: closeScanResult });
  useModalBehavior({ open: checkoutSeals !== null, onClose: closeCheckoutSeals });
  useModalBehavior({ open: confirmState.open, onClose: closeConfirm });

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

        /**
         * Mühür numaralarını dükkan stoğundan ÖN DOLDUR.
         *
         * Esnaf 3 valiz için üç numarayı elle yazacak olsa bu adım pratikte
         * atlanır — nitekim atlanıyordu: `BookingSeal` tablosu tamamen boştu.
         * Öneri gelmezse alanlar boş kalır ve esnaf yine elle yazabilir.
         */
        const rows = buildSealRows(
          preview.bagCountS,
          preview.bagCountM,
          preview.bagCountXl,
        );
        setFaultySeals([]);
        setSealRows(rows);
        if (rows.length > 0) {
          setSealsLoading(true);
          try {
            const suggested = await getNextAvailableSealsAction(shopId, rows.length);
            if (suggested.success) {
              setSealRows(
                rows.map((r, i) => ({
                  ...r,
                  sealNumber:
                    suggested.seals[i] !== undefined
                      ? String(suggested.seals[i].sealNumber)
                      : "",
                })),
              );
            }
          } finally {
            setSealsLoading(false);
          }
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [shopId, showError, t]
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
      /**
       * Mühür varsa TEK TEK onaylatılır; yoksa (eski kayıtlar, mühürsüz
       * dönemde alınan valizler) eski genel onay penceresine düşülür —
       * mühürsüz bir rezervasyonu onaylanacak mühür yok diye kilitlemek
       * teslimi imkânsız kılardı.
       */
      const res = await getPartnerBookingSealsAction(bookingId);
      if (res.success && res.seals.length > 0) {
        setCheckoutSeals({ bookingId, seals: res.seals, confirmed: [] });
        return;
      }
      askConfirm(t("confirmCheckout"), async () => {
        await executeCheckout(bookingId);
      });
    },
    [askConfirm, executeCheckout, t]
  );

  const toggleCheckoutSeal = (sealNumber: number) => {
    setCheckoutSeals((prev) =>
      prev
        ? {
            ...prev,
            confirmed: prev.confirmed.includes(sealNumber)
              ? prev.confirmed.filter((n) => n !== sealNumber)
              : [...prev.confirmed, sealNumber],
          }
        : prev,
    );
  };



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

  const markSealFaulty = (bagIndex: number) => {
    setSealRows((prev) => {
      const row = prev.find((r) => r.bagIndex === bagIndex);
      const parsed = Number(row?.sealNumber);
      if (row && Number.isInteger(parsed) && parsed > 0) {
        setFaultySeals((f) => (f.includes(parsed) ? f : [...f, parsed]));
      }
      // Numara temizlenir: bozuk mühür bu valize takılamaz, esnaf yenisini yazar.
      return prev.map((r) => (r.bagIndex === bagIndex ? { ...r, sealNumber: "" } : r));
    });
  };

  const setSealNumber = (bagIndex: number, value: string) => {
    // Yalnızca rakam: seri numarası tamsayı ve sunucu `z.number().int()` bekliyor.
    const digits = value.replace(/\D/g, "").slice(0, 10);
    setSealRows((prev) =>
      prev.map((r) => (r.bagIndex === bagIndex ? { ...r, sealNumber: digits } : r)),
    );
  };

  const filledSealCount = sealRows.filter((r) => r.sealNumber.trim() !== "").length;
  const sealsIncomplete =
    requireSeals && sealRows.length > 0 && filledSealCount !== sealRows.length;

  const handleCheckIn = async () => {
    if (!scanResult) return;

    /**
     * Ayar açıkken eksik mühürle sunucuya GİTMEYİZ. Sunucu zaten reddediyor
     * ama esnafın hatayı butona bastıktan sonra öğrenmesi için sebep yok.
     */
    if (sealsIncomplete) {
      showError(t("sealNumbersRequired"));
      return;
    }

    const sealAssignments = sealRows
      .filter((r) => r.sealNumber.trim() !== "")
      .map((r) => ({
        sealNumber: Number(r.sealNumber),
        bagIndex: r.bagIndex,
        bagSize: r.bagSize,
      }));

    const hasSealInput = sealAssignments.length > 0 || faultySeals.length > 0;

    setIsProcessing(true);
    const result = await checkInAction(
      scanResult.id,
      hasSealInput ? { sealAssignments, faultySealNumbers: faultySeals } : undefined,
    );
    setIsProcessing(false);

    if (result.success) {
      setSuccessBanner(t("checkInSuccess"));
      setScanResult(null);
      setSealRows([]);
      setFaultySeals([]);
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gray-50 px-4 pb-32 pt-6 font-sans text-gray-900 sm:px-6 md:p-12 md:pb-36">
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-checkin-title"
            className="bg-white text-gray-900 rounded-[2.5rem] w-full max-w-lg p-10 flex flex-col gap-8 shadow-2xl relative border border-gray-100 my-8"
          >
            <button
              type="button"
              onClick={closeScanResult}
              aria-label={t("checkoutCancel")}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X size={20} />
            </button>

                <div className="flex items-center gap-6">
                  <div className="rounded-[2rem] bg-orange-100 p-5 text-orange-600 ring-4 ring-orange-50 shadow-inner">
                    <Package size={32} />
                  </div>
                  <div>
                    <h3
                      id="partner-checkin-title"
                      className="text-2xl font-black tracking-tighter"
                    >
                      {scanResult.guestName}
                    </h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      {scanResult.bags}
                    </p>
                  </div>
                </div>

                {sealRows.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-orange-600" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">
                        {t("sealAssignmentsTitle")}
                      </h4>
                      {sealsLoading && (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      )}
                    </div>

                    <p className="text-xs leading-relaxed text-gray-500">
                      {t("automaticSealNotice")}
                    </p>

                    <ul className="flex flex-col gap-2">
                      {sealRows.map((row) => {
                        const inputId = `seal-${row.bagIndex}`;
                        const rowLabel = t("sealRowLabel", {
                          index: row.bagIndex + 1,
                          size: row.bagSize,
                        });
                        return (
                          <li key={row.bagIndex} className="flex items-center gap-2">
                            <label
                              htmlFor={inputId}
                              className="w-28 shrink-0 text-xs font-bold text-gray-600"
                            >
                              {rowLabel}
                            </label>
                            <div className="flex flex-1 items-center gap-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 focus-within:border-orange-400 focus-within:bg-white">
                              <span aria-hidden="true" className="text-xs font-black text-gray-400">
                                {t("sealNumberShort")}
                              </span>
                              <input
                                id={inputId}
                                inputMode="numeric"
                                autoComplete="off"
                                value={row.sealNumber}
                                onChange={(e) => setSealNumber(row.bagIndex, e.target.value)}
                                className="h-11 w-full bg-transparent text-sm font-bold tabular-nums text-gray-900 outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => markSealFaulty(row.bagIndex)}
                              disabled={row.sealNumber.trim() === ""}
                              title={t("markSealFaulty")}
                              aria-label={`${t("markSealFaulty")} — ${rowLabel}`}
                              className="shrink-0 rounded-2xl border border-gray-200 p-2.5 text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            >
                              <AlertTriangle size={16} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {faultySeals.length > 0 && (
                      <p className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                        <AlertTriangle size={14} />
                        {t("markSealFaulty")}: {faultySeals.join(", ")}
                      </p>
                    )}

                    {sealsIncomplete && (
                      <p
                        role="alert"
                        className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
                      >
                        <AlertTriangle size={14} />
                        {t("sealNumbersRequired")}
                      </p>
                    )}
                  </div>
                )}

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

      {checkoutSeals && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-checkout-seals-title"
            aria-describedby="partner-checkout-seals-desc"
            className="ui-card my-8 flex w-full max-w-md flex-col gap-5 p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3
                  id="partner-checkout-seals-title"
                  className="text-lg font-black tracking-tight text-gray-900"
                >
                  {t("checkoutSealsTitle")}
                </h3>
                <p
                  id="partner-checkout-seals-desc"
                  className="text-xs leading-relaxed text-gray-500"
                >
                  {t("checkoutSealConfirmEach")}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckoutSeals}
                aria-label={t("checkoutCancel")}
                className="shrink-0 rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="flex flex-col gap-2">
              {checkoutSeals.seals.map((seal) => {
                const checked = checkoutSeals.confirmed.includes(seal.sealNumber);
                return (
                  <li key={`${seal.bagIndex}-${seal.sealNumber}`}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                        checked
                          ? "border-orange-200 bg-orange-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCheckoutSeal(seal.sealNumber)}
                        className="h-5 w-5 shrink-0 accent-orange-600"
                      />
                      <span className="flex-1 text-xs font-bold text-gray-600">
                        {t("sealRowLabel", {
                          index: seal.bagIndex + 1,
                          size: seal.bagSize,
                        })}
                      </span>
                      <span className="text-sm font-black tabular-nums text-gray-900">
                        {t("sealNumberShort")}
                        {seal.sealNumber}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={
                  checkoutSeals.confirmed.length !== checkoutSeals.seals.length ||
                  checkingOutId === checkoutSeals.bookingId
                }
                onClick={() => {
                  const id = checkoutSeals.bookingId;
                  setCheckoutSeals(null);
                  void executeCheckout(id);
                }}
                className="btn-ui btn-ui-md btn-ui-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
              >
                {checkingOutId === checkoutSeals.bookingId ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  t("confirmCheckoutSeals")
                )}
              </button>
              <button
                type="button"
                onClick={closeCheckoutSeals}
                className="btn-ui btn-ui-md btn-ui-ghost w-full"
              >
                {t("checkoutCancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-describedby="partner-confirm-message"
            className="ui-card w-full max-w-sm p-6 flex flex-col gap-4"
          >
            <p
              id="partner-confirm-message"
              className="text-sm font-semibold text-gray-700 leading-relaxed"
            >
              {confirmState.message}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeConfirm}
                className="btn-ui btn-ui-md btn-ui-ghost flex-1"
              >
                {t("checkoutCancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmState.onConfirm;
                  closeConfirm();
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

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between md:mb-12">
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
            className="group mx-auto flex aspect-square w-full max-w-[280px] flex-col items-center justify-center gap-5 overflow-hidden rounded-[2.5rem] bg-gray-900 text-white shadow-2xl transition-all hover:bg-black active:scale-95 sm:max-w-xs md:max-w-sm md:gap-8 md:rounded-[4rem]"
          >
            <div className="bg-white/10 p-8 rounded-full group-hover:scale-110 transition-transform">
              <Camera size={64} strokeWidth={1} />
            </div>
            <span className="text-2xl font-black tracking-tight px-8 text-center leading-tight">
              {t("newBagDropoff")}
            </span>
          </button>

          <div className="grid w-full grid-cols-2 gap-3 md:gap-6">
            <div className="flex flex-col gap-1 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-xl shadow-gray-100/50 md:rounded-[2.5rem] md:p-6">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                {t("activeBookings")}
              </p>
              <p className="text-3xl font-black text-gray-900 md:text-4xl">{activeCount}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-xl shadow-gray-100/50 md:rounded-[2.5rem] md:p-6">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
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
                        {/*
                          `min-w-0` + `truncate`: uzun misafir adı kart düzenini
                          bozuyordu (flex öğesi varsayılan `min-width: auto`).
                        */}
                        <div className="min-w-0">
                          <h3 className="truncate font-black text-gray-900 tracking-tight">
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

                    {/*
                      GECİKME ROZETİ.

                      Çıkış butonu zaten vardı ve liste tarih filtresi taşımıyor —
                      yani Haziran'dan kalan bir rezervasyon da ekranda duruyordu.
                      Sorun görünürlük değil, AYIRT EDİLEBİLİRLİKTİ: o kayıt
                      listede dünkü bir rezervasyondan hiçbir farkla görünmüyordu
                      ve partnere "burada bekleyen bir iş var" diyen hiçbir sinyal
                      yoktu. Prod'da 19 rezervasyonun 18'i böyle bekliyordu
                      (P1-6 / P1-22).
                    */}
                    {(booking.status as string) === "CHECKED_IN" &&
                    overdueOf(booking.checkOutTime).severity !== "none" ? (
                      <div
                        className={`mb-3 rounded-2xl px-4 py-3 ${
                          overdueOf(booking.checkOutTime).severity === "critical"
                            ? "bg-red-50 border border-red-200"
                            : overdueOf(booking.checkOutTime).severity === "late"
                              ? "bg-amber-50 border border-amber-200"
                              : "bg-gray-50 border border-gray-200"
                        }`}
                      >
                        <p
                          className={`text-xs font-black ${
                            overdueOf(booking.checkOutTime).severity === "critical"
                              ? "text-red-700"
                              : overdueOf(booking.checkOutTime).severity === "late"
                                ? "text-amber-800"
                                : "text-gray-600"
                          }`}
                        >
                          {overdueOf(booking.checkOutTime).overdueDays >= 1
                            ? t("overdueBadgeDays", {
                                days: overdueOf(booking.checkOutTime).overdueDays,
                              })
                            : t("overdueBadgeHours", {
                                hours: overdueOf(booking.checkOutTime).overdueHours,
                              })}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-gray-500">
                          {t("overdueHint")}
                        </p>
                      </div>
                    ) : null}

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
                         <p className="text-lg font-black text-gray-900"><Money amount={moneyToNumber(booking.totalPrice)} /></p>
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

      <nav className="fixed bottom-3 left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 justify-around gap-2 rounded-[2rem] border border-gray-100 bg-white/90 px-3 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:bottom-8 sm:w-auto sm:gap-8 sm:px-6 sm:py-4">
        <button
          type="button"
          onClick={() => setActiveTab("PANEL")}
          aria-label={t("partnerPanelActive")}
          title={t("partnerPanelActive")}
          className={`p-3 rounded-2xl transition-all ${activeTab === "PANEL" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Home size={24} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("TALEPLER")}
          aria-label={t("incomingRequests")}
          title={t("incomingRequests")}
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
          aria-label={t("transactionHistory")}
          title={t("transactionHistory")}
          className={`p-3 rounded-2xl transition-all ${activeTab === "GECMIS" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <BarChart3 size={24} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("AYARLAR")}
          aria-label={t("settings")}
          title={t("settings")}
          className={`p-3 rounded-2xl transition-all ${activeTab === "AYARLAR" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Settings size={24} />
        </button>
      </nav>
    </div>
  );
}
