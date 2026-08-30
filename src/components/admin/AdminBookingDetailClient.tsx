"use client";

import { useState } from "react";
import {
  ArrowLeft,
  User,
  Store,
  CreditCard,
  Mail,
  Shield,
  History,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import Money from "@/components/common/Money";

type Seal = {
  id: string;
  serialNumber: number;
  bagIndex: number;
  bagSize: string;
  sealStatus: string;
};

type Notification = {
  id: string;
  type: string;
  recipient: string;
  status: string;
  error: string | null;
  createdAt: string;
};

export type AdminBookingDetail = {
  id: string;
  status: string;
  createdAt: string;
  checkInTime: string;
  checkOutTime: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  unitPrice: number;
  totalPrice: number;
  insuranceFee: number;
  lateFeeApplied: number;
  referralDiscountAmount: number;
  referredByCode: string | null;
  qrCodeToken: string | null;
  slotCount: number;
  guest: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  guestEmail: string | null;
  guestPhone: string | null;
  shop: { id: string; name: string; city: string | null; district: string | null };
  dispute: { id: string; status: string; reason: string } | null;
  review: { rating: number; comment: string | null } | null;
  seals: Seal[];
  notifications: Notification[];
};

export type AdminBookingPayment = {
  status: string;
  provider: string;
  providerRef: string | null;
  transactionId: string | null;
  amount: number;
  refundedAmount: number;
  failureReason: string | null;
  chargebackStatus: string | null;
  capturedAt: string | null;
  refundedAt: string | null;
  split: {
    status: string;
    grossAmount: number;
    platformCommission: number;
    merchantAmount: number;
    settledAt: string | null;
  } | null;
};

export type AdminBookingEvent = {
  id: string;
  event: string;
  actorId: string | null;
  actorRole: string | null;
  /** Ham JSON metni; ekranda katlanır olarak gösterilir. */
  metadata: string | null;
  createdAt: string;
};

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="id-surface p-6">
      <h2 className="flex items-center gap-2 text-xs id-eyebrow text-gray-500 mb-4">
        <Icon size={14} />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

export default function AdminBookingDetailClient({
  booking,
  payment,
  events,
}: {
  booking: AdminBookingDetail;
  payment: AdminBookingPayment | null;
  events: AdminBookingEvent[];
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
  const [openEvent, setOpenEvent] = useState<string | null>(null);

  function fmt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(dateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const bagTotal = booking.bagCountS + booking.bagCountM + booking.bagCountXl;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={14} />
          {t("bookingsBackToSearch")}
        </Link>

        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-3xl id-display text-gray-900">
            {booking.guest?.name ?? booking.guestEmail ?? t("anonymous")}
          </h1>
          <span className="px-3 py-1 rounded-xl bg-gray-900 text-white text-[10px] id-eyebrow">
            {t(`bookingStatus_${booking.status}`)}
          </span>
          {booking.dispute ? (
            <Link
              href="/admin/disputes"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-red-100 text-red-700 text-[10px] id-eyebrow"
            >
              <AlertTriangle size={12} />
              {t("bookingsHasDispute")}
            </Link>
          ) : null}
        </div>
        <p className="text-xs text-gray-400 mb-8 break-all">{booking.id}</p>

        <div className="grid gap-6 md:grid-cols-2">
          <Section icon={User} title={t("bookingsSectionGuest")}>
            <Row label={t("fullName")} value={booking.guest?.name ?? t("anonymous")} />
            <Row
              label={t("bookingsGuestEmail")}
              value={booking.guest?.email ?? booking.guestEmail ?? "—"}
            />
            <Row
              label={t("phone")}
              value={booking.guest?.phone ?? booking.guestPhone ?? "—"}
            />
            <Row
              label={t("bookingsGuestAccount")}
              value={booking.guest ? t("bookingsGuestRegistered") : t("bookingsGuestCheckout")}
            />
          </Section>

          <Section icon={Store} title={t("bookingsSectionShop")}>
            <Row label={t("shopName")} value={booking.shop.name} />
            <Row
              label={t("shopAddress")}
              value={[booking.shop.district, booking.shop.city].filter(Boolean).join(", ") || "—"}
            />
            <Row label={t("bookingsSlotCount")} value={booking.slotCount} />
            <Row label={t("bookingsQrToken")} value={booking.qrCodeToken ?? "—"} />
          </Section>

          <Section icon={History} title={t("bookingsSectionWindow")}>
            <Row label={t("bookingsReservedCheckIn")} value={fmt(booking.checkInTime)} />
            <Row label={t("bookingsReservedCheckOut")} value={fmt(booking.checkOutTime)} />
            <Row label={t("bookingsActualCheckIn")} value={fmt(booking.checkedInAt)} />
            <Row label={t("bookingsActualCheckOut")} value={fmt(booking.checkedOutAt)} />
            <Row label={t("bookingsCreatedAt")} value={fmt(booking.createdAt)} />
          </Section>

          <Section icon={CreditCard} title={t("bookingsSectionMoney")}>
            <Row
              label={t("bookingsBags")}
              value={`${bagTotal} (S ${booking.bagCountS} / M ${booking.bagCountM} / XL ${booking.bagCountXl})`}
            />
            <Row label={t("bookingsUnitPrice")} value={<Money amount={booking.unitPrice} />} />
            <Row
              label={t("platformSettingsInsuranceFee")}
              value={<Money amount={booking.insuranceFee} />}
            />
            <Row
              label={t("bookingsLateFee")}
              value={<Money amount={booking.lateFeeApplied} />}
            />
            <Row
              label={t("bookingsReferralDiscount")}
              value={
                <span>
                  {booking.referredByCode ? `${booking.referredByCode} · ` : ""}
                  <Money amount={booking.referralDiscountAmount} />
                </span>
              }
            />
            <Row
              label={t("bookingsTotal")}
              value={
                <strong>
                  <Money amount={booking.totalPrice} />
                </strong>
              }
            />
          </Section>

          <Section icon={CreditCard} title={t("bookingsSectionPayment")}>
            {payment ? (
              <>
                <Row label={t("status")} value={t(`paymentStatus_${payment.status}`)} />
                <Row label={t("paymentsProvider")} value={payment.provider} />
                <Row label={t("paymentsAmount")} value={<Money amount={payment.amount} />} />
                <Row
                  label={t("paymentsRefunded")}
                  value={<Money amount={payment.refundedAmount} />}
                />
                <Row label={t("paymentsCapturedAt")} value={fmt(payment.capturedAt)} />
                {payment.failureReason ? (
                  <Row label={t("paymentsFailureReason")} value={payment.failureReason} />
                ) : null}
                {payment.chargebackStatus ? (
                  <Row label={t("paymentsChargeback")} value={payment.chargebackStatus} />
                ) : null}
                {payment.split ? (
                  <>
                    <Row
                      label={t("paymentsSplitStatus")}
                      value={t(`splitStatus_${payment.split.status}`)}
                    />
                    <Row
                      label={t("paymentsCommission")}
                      value={<Money amount={payment.split.platformCommission} />}
                    />
                    <Row
                      label={t("paymentsMerchantAmount")}
                      value={<Money amount={payment.split.merchantAmount} />}
                    />
                  </>
                ) : (
                  <Row label={t("paymentsSplitStatus")} value={t("paymentsNoSplit")} />
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">{t("bookingsNoPaymentRow")}</p>
            )}
          </Section>

          <Section icon={Shield} title={t("bookingsSectionSeals")}>
            {booking.seals.length === 0 ? (
              <p className="text-sm text-gray-400">{t("bookingsNoSeals")}</p>
            ) : (
              booking.seals.map((s) => (
                <Row
                  key={s.id}
                  label={`#${s.bagIndex + 1} · ${s.bagSize}`}
                  value={`${s.serialNumber} · ${t(`sealStatus_${s.sealStatus}`)}`}
                />
              ))
            )}
          </Section>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Section icon={Mail} title={t("bookingsSectionNotifications")}>
            {booking.notifications.length === 0 ? (
              <p className="text-sm text-gray-400">{t("notificationsEmpty")}</p>
            ) : (
              booking.notifications.map((n) => (
                <Row
                  key={n.id}
                  label={`${n.type} · ${fmt(n.createdAt)}`}
                  value={
                    <span className={n.status === "SENT" ? "text-emerald-600" : "text-red-600"}>
                      {n.recipient} · {n.status}
                      {n.error ? ` · ${n.error}` : ""}
                    </span>
                  }
                />
              ))
            )}
          </Section>

          <Section icon={History} title={t("bookingsSectionTimeline")}>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">{t("bookingsNoEvents")}</p>
            ) : (
              <ol className="space-y-3">
                {events.map((e) => {
                  const open = openEvent === e.id;
                  return (
                    <li key={e.id} className="border-l-2 border-gray-200 pl-4 relative">
                      <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full id-accent-bg" />
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{e.event}</p>
                          <p className="text-xs text-gray-400">
                            {fmt(e.createdAt)}
                            {e.actorRole ? ` · ${t(`userRole_${e.actorRole}`)}` : ""}
                          </p>
                        </div>
                        {e.metadata ? (
                          <button
                            type="button"
                            onClick={() => setOpenEvent(open ? null : e.id)}
                            className="text-xs text-gray-400 hover:text-gray-900 flex items-center gap-1"
                          >
                            {t("viewRawData")}
                            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        ) : null}
                      </div>
                      {open && e.metadata ? (
                        <pre className="mt-2 p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600 overflow-x-auto">
                          {e.metadata}
                        </pre>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
