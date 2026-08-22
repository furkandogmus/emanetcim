"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import DateTimePicker from "@/components/ui/DateTimePicker";
import BagSelector from "@/components/guest/BagSelector";
import { modifyBookingAction } from "@/actions/booking";
import {
  computeServiceTotalForStay,
  roundedSlotPrices,
} from "@/lib/bag-pricing";
import {
  computeStayDaysFromWindow,
  validateBookingStayWindow,
} from "@/lib/booking-server-price";
import { parseDatetimeLocal, toDatetimeLocalValue } from "@/lib/datetime-local";
import type { PricingRules } from "@/lib/pricing-rules";
import type { GuestBookingListItem } from "@/services/BookingService";
import { moneyToNumber } from "@/lib/money";
import { usePaymentCopyKey } from "@/components/providers/CommerceProvider";

export type BookingModifyModalBooking = Pick<
  GuestBookingListItem,
  | "id"
  | "bagCountS"
  | "bagCountM"
  | "bagCountXl"
  | "checkInTime"
  | "checkOutTime"
  | "totalPrice"
  | "status"
> & {
  shop?: { pricePerDay?: unknown; name?: string | null } | null;
};

interface BookingModifyModalProps {
  booking: BookingModifyModalBooking;
  pricingRules: PricingRules;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BookingModifyModal({
  booking,
  pricingRules,
  onClose,
  onSuccess,
}: BookingModifyModalProps) {
  const t = useTranslations("Guest");
  /**
   * Ödeme metni aktif sağlayıcıya göre seçilir. Bu satır eskiden koşulsuz
   * "kartınıza iade edilir" diyordu; ödeme dükkanda alınırken bu yanlıştı
   * (P1-19).
   */
  const payKey = usePaymentCopyKey();
  const tErr = useTranslations("Errors");
  const pricePerDay = moneyToNumber(booking.shop?.pricePerDay ?? 0);
  const slot = roundedSlotPrices(pricePerDay, pricingRules);

  const [bagS, setBagS] = useState(booking.bagCountS);
  const [bagM, setBagM] = useState(booking.bagCountM);
  const [bagXl, setBagXl] = useState(booking.bagCountXl);
  const [checkInLocal, setCheckInLocal] = useState(() =>
    toDatetimeLocalValue(new Date(booking.checkInTime)),
  );
  const [checkOutLocal, setCheckOutLocal] = useState(() =>
    toDatetimeLocalValue(new Date(booking.checkOutTime)),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const checkInDate = parseDatetimeLocal(checkInLocal);
  const checkOutDate = parseDatetimeLocal(checkOutLocal);
  const windowOk =
    checkInDate !== null &&
    checkOutDate !== null &&
    validateBookingStayWindow(checkInDate, checkOutDate, pricingRules);
  const billableDays =
    checkInDate && checkOutDate
      ? computeStayDaysFromWindow(checkInDate, checkOutDate, pricingRules)
      : 1;

  const servicePreview =
    windowOk && checkInDate && checkOutDate
      ? computeServiceTotalForStay(
          pricePerDay,
          bagS,
          bagM,
          bagXl,
          billableDays,
          pricingRules
        )
      : 0;
  const insurancePreview =
    servicePreview > 0 ? pricingRules.insuranceFeeTry : 0;
  const previewGrand = Math.round((servicePreview + insurancePreview) * 100) / 100;
  const oldGrand = moneyToNumber(booking.totalPrice);
  const delta = Math.round((previewGrand - oldGrand) * 100) / 100;

  const handleSubmit = async () => {
    setErr(null);
    if (!checkInDate || !checkOutDate || !windowOk) {
      setErr(
        t("checkoutDatesInvalid", { max: pricingRules.maxStayDays })
      );
      return;
    }
    if (bagS + bagM + bagXl < 1) {
      setErr(t("checkoutSelectBagsHint"));
      return;
    }
    if (booking.status === "PAID" && delta > 0.005) {
      setErr(t("modifyPaidIncreaseHint"));
      return;
    }

    setSaving(true);
    const res = await modifyBookingAction({
      bookingId: booking.id,
      checkInTime: checkInDate,
      checkOutTime: checkOutDate,
      bagCountS: bagS,
      bagCountM: bagM,
      bagCountXl: bagXl,
    });
    setSaving(false);

    if (res.success) {
      onSuccess();
      onClose();
      return;
    }
    const code = res.error;
    if (code?.startsWith("Errors.")) {
      setErr(tErr(code.slice(7) as never));
    } else {
      setErr(code ?? t("checkoutUnexpectedError"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modify-booking-title"
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <h2
            id="modify-booking-title"
            className="text-lg font-black text-gray-900"
          >
            {t("modifyBookingTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ui btn-ui-sm btn-ui-ghost btn-ui-icon rounded-full text-gray-500"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 pb-28">
          {booking.shop?.name ? (
            <p className="text-xs text-gray-500 font-medium">{booking.shop.name}</p>
          ) : null}

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {t("checkoutCheckInLabel")}
              </span>
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <DateTimePicker
                  value={checkInLocal}
                  onChange={setCheckInLocal}
                  ariaLabel={t("checkoutCheckInLabel")}
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {t("checkoutCheckOutLabel")}
              </span>
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <DateTimePicker
                  value={checkOutLocal}
                  onChange={setCheckOutLocal}
                  ariaLabel={t("checkoutCheckOutLabel")}
                  minDate={parseDatetimeLocal(checkInLocal) ?? undefined}
                />
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <BagSelector
              label={t("smallBag")}
              sublabel={`S / ₺${slot.s}`}
              count={bagS}
              onIncrease={() => setBagS(bagS + 1)}
              onDecrease={() => setBagS(Math.max(0, bagS - 1))}
            />
            <BagSelector
              label={t("mediumBag")}
              sublabel={`M/L / ₺${slot.m}`}
              count={bagM}
              onIncrease={() => setBagM(bagM + 1)}
              onDecrease={() => setBagM(Math.max(0, bagM - 1))}
            />
            <BagSelector
              label={t("xlBag")}
              sublabel={`XL / ₺${slot.xl}`}
              count={bagXl}
              onIncrease={() => setBagXl(bagXl + 1)}
              onDecrease={() => setBagXl(Math.max(0, bagXl - 1))}
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">{t("modifyPreviewNewTotal")}</span>
              <span className="font-black">₺{previewGrand}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">{t("modifyPreviewDelta")}</span>
              <span
                className={
                  delta > 0.005
                    ? "font-bold text-orange-600"
                    : delta < -0.005
                      ? "font-bold text-green-600"
                      : "font-medium text-gray-600"
                }
              >
                {delta > 0.005 ? "+" : ""}
                ₺{delta}
              </span>
            </div>
            {booking.status === "PAID" && delta < -0.005 ? (
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {t(payKey("modifyRefundNote"))}
              </p>
            ) : null}
            {booking.status === "PAID" && delta > 0.005 ? (
              <p className="text-[10px] text-orange-700 font-bold">
                {t("modifyPaidIncreaseHint")}
              </p>
            ) : null}
          </div>

          {!windowOk ? (
            <p className="text-xs font-bold text-orange-600">
              {t("checkoutDatesInvalid", { max: pricingRules.maxStayDays })}
            </p>
          ) : null}

          {err ? (
            <p className="text-xs font-bold text-red-600">{err}</p>
          ) : null}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-ui btn-ui-md btn-ui-ghost flex-1 rounded-2xl"
          >
            {t("modifyCancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              saving ||
              !windowOk ||
              bagS + bagM + bagXl < 1 ||
              (booking.status === "PAID" && delta > 0.005)
            }
            className="btn-ui btn-ui-md btn-ui-primary flex-1 rounded-2xl bg-gray-900 hover:bg-black text-white"
          >
            {saving ? "…" : t("modifySave")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function canGuestModifyBooking(status: string): boolean {
  return (
    status === "WAITING_APPROVAL" ||
    status === "APPROVED" ||
    status === "PENDING" ||
    status === "PAID"
  );
}
