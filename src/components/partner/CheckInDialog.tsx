"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Loader2, Package, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { checkInAction, getNextAvailableSealsAction } from "@/actions/partner";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";
import { useActionErrorText } from "@/lib/use-action-error";

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

export type CheckInPreview = {
  id: string;
  guestName: string;
  bags: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  totalBags: number;
};

interface CheckInDialogProps {
  preview: CheckInPreview;
  shopId: string;
  /** `PlatformSettings.requireSealsOnCheckIn` — açıkken eksik mühürle sunucuya gidilmez. */
  requireSeals: boolean;
  onClose: () => void;
  /** Check-in sunucuda başarıyla tamamlandı; ebeveyn listeyi tazeler. */
  onSuccess: () => void;
}

/**
 * Check-in onay kutusu: misafir + valiz özeti, valiz başına mühür numarası,
 * bozuk mühür bildirimi. `PartnerClient`'tan ayrıldı (2026-08-22): 1100
 * satırlık bileşende dört modal ve iki akış iç içeydi.
 */
export default function CheckInDialog({
  preview,
  shopId,
  requireSeals,
  onClose,
  onSuccess,
}: CheckInDialogProps) {
  const t = useTranslations("Partner");
  const errorText = useActionErrorText();
  useModalBehavior({ open: true, onClose });

  const [sealRows, setSealRows] = useState<SealRow[]>(() =>
    buildSealRows(preview.bagCountS, preview.bagCountM, preview.bagCountXl),
  );
  /**
   * Stoktan çıkan ama fiziksel olarak bozuk mühürler. Atamalardan AYRI tutulur:
   * sunucu bunları `FAULTY` yapar ve aynı numaranın hem atanmış hem bozuk
   * gelmesini `faulty_overlaps_assignment` ile reddeder.
   */
  const [faultySeals, setFaultySeals] = useState<number[]>([]);
  // Efekt içinde senkron setState yasak (react-hooks); yükleniyor durumu baştan bilinir.
  const [sealsLoading, setSealsLoading] = useState(
    () => preview.bagCountS + preview.bagCountM + preview.bagCountXl > 0,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Mühür numaralarını dükkan stoğundan ÖN DOLDUR.
   *
   * Esnaf 3 valiz için üç numarayı elle yazacak olsa bu adım pratikte
   * atlanır — nitekim atlanıyordu: `BookingSeal` tablosu tamamen boştu.
   * Öneri gelmezse alanlar boş kalır ve esnaf yine elle yazabilir.
   */
  useEffect(() => {
    const count = preview.bagCountS + preview.bagCountM + preview.bagCountXl;
    if (count === 0) return;
    let cancelled = false;
    getNextAvailableSealsAction(shopId, count)
      .then((suggested) => {
        if (cancelled || !suggested.success) return;
        setSealRows((rows) =>
          rows.map((r, i) => ({
            ...r,
            sealNumber:
              r.sealNumber === "" && suggested.seals[i] !== undefined
                ? String(suggested.seals[i].sealNumber)
                : r.sealNumber,
          })),
        );
      })
      .finally(() => {
        if (!cancelled) setSealsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview.id, preview.bagCountS, preview.bagCountM, preview.bagCountXl, shopId]);

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
    /**
     * Ayar açıkken eksik mühürle sunucuya GİTMEYİZ. Sunucu zaten reddediyor
     * ama esnafın hatayı butona bastıktan sonra öğrenmesi için sebep yok.
     */
    if (sealsIncomplete) {
      toast.error(t("sealNumbersRequired"));
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
      preview.id,
      hasSealInput ? { sealAssignments, faultySealNumbers: faultySeals } : undefined,
    );
    setIsProcessing(false);

    if (result.success) {
      onSuccess();
    } else {
      toast.error(errorText(result.error, t("checkInFailed")));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 text-white animate-in fade-in duration-300 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-checkin-title"
        className="bg-white text-gray-900 rounded-4xl w-full max-w-lg p-10 flex flex-col gap-8 shadow-2xl relative border border-gray-100 my-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("checkoutCancel")}
          className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X size={20} />
        </button>

            <div className="flex items-center gap-6">
              <div className="rounded-3xl bg-orange-100 p-5 text-orange-600 ring-4 ring-orange-50 shadow-inner">
                <Package size={32} />
              </div>
              <div>
                <h3
                  id="partner-checkin-title"
                  className="text-2xl font-black tracking-tighter"
                >
                  {preview.guestName}
                </h3>
                <p className="text-xs id-eyebrow text-gray-400">
                  {preview.bags}
                </p>
              </div>
            </div>

            {sealRows.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-orange-600" />
                  <h4 className="text-xs id-eyebrow text-gray-500">
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
              className={` flex h-20 w-full items-center justify-center gap-3 rounded-3xl text-sm id-eyebrow shadow-2xl transition-all active:scale-95 ${
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
  );
}
