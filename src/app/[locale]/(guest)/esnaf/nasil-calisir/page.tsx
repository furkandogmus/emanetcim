import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  Lock,
  QrCode,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { socialMetadata } from "@/lib/social-metadata";
import { getPaymentCopyMode } from "@/lib/payment-copy";
import PartnerQrFlow from "@/components/guest/PartnerQrFlow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PartnerSignup" });
  const base = getSiteBaseUrl();
  const title = t("howMetaTitle");
  const description = t("howSubtitle");
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/esnaf/nasil-calisir"),
    ...socialMetadata({ url: `${base}/${locale}/esnaf/nasil-calisir`, title, description }),
  };
}

/** Esnaf panelini andiran kucuk ekran. Gercek ekran goruntusu degil; akisi anlatan sema. */
function PhoneMock({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-[280px] rounded-4xl border-[6px] border-gray-900 bg-gray-900 shadow-xl shadow-gray-900/15">
      <div className="rounded-4xl bg-gray-50 p-4">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />
        <div className="flex flex-col gap-2.5">{children}</div>
      </div>
    </div>
  );
}

function MockCard({ children, tone = "white" }: { children: ReactNode; tone?: "white" | "brand" | "green" }) {
  const toneClass =
    tone === "brand"
      ? "border-brand-200 bg-brand-50"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50"
        : "border-gray-100 bg-white";
  return <div className={`rounded-2xl border p-3 text-sm ${toneClass}`}>{children}</div>;
}

function MockButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "ghost" }) {
  return (
    <div
      className={`flex-1 rounded-xl py-2 text-center text-xs font-bold ${
        variant === "primary" ? "bg-brand-600 text-white" : "border border-gray-200 bg-white text-gray-700"
      }`}
    >
      {children}
    </div>
  );
}

const SAMPLE_GUEST = "Emma L.";
const SAMPLE_SEALS = ["004218", "004219"];

export default async function PartnerHowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PartnerSignup");
  const onsite = getPaymentCopyMode() !== "online";

  const steps: { Icon: typeof Bell; title: string; body: string; mock: ReactNode; wide?: boolean }[] = [
    {
      Icon: Bell,
      title: t("flow1Title"),
      body: t("flow1Body"),
      mock: (
        <>
          <MockCard tone="brand">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{t("mockNewBooking")}</p>
            <p className="mt-1 font-bold text-gray-900">{SAMPLE_GUEST}</p>
            <p className="text-xs text-gray-600">{t("mockBags", { count: 2 })} · {t("mockToday")} 14:00–19:00</p>
          </MockCard>
          <div className="flex gap-2">
            <MockButton>{t("mockApprove")}</MockButton>
            <MockButton variant="ghost">{t("mockReject")}</MockButton>
          </div>
        </>
      ),
    },
    {
      Icon: QrCode,
      title: t("flow2Title"),
      body: t("flow2Body"),
      wide: true,
      mock: (
        <PartnerQrFlow
          labels={{
            guestPhone: t("qrGuestPhone"),
            yourPhone: t("qrYourPhone"),
            bookingQr: t("qrBookingQr"),
            scanButton: t("qrScanButton"),
            scanned: t("qrScanned"),
            bags: t("mockBags", { count: 2 }),
          }}
        />
      ),
    },
    {
      Icon: Lock,
      title: t("flow3Title"),
      body: t("flow3Body"),
      mock: (
        <>
          <MockCard>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t("mockSealNumbers")}</p>
            {SAMPLE_SEALS.map((s) => (
              <div key={s} className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-sm font-bold">
                #{s}
              </div>
            ))}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-gray-500">
              <Camera size={14} /> {t("mockAddPhoto")}
            </div>
          </MockCard>
          <div className="flex">
            <MockButton>{t("mockCheckIn")}</MockButton>
          </div>
        </>
      ),
    },
    {
      Icon: CheckCircle2,
      title: t("flow4Title"),
      body: t("flow4Body"),
      mock: (
        <>
          <MockCard tone="green">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">{t("mockSealCheck")}</p>
            {SAMPLE_SEALS.map((s) => (
              <div key={s} className="mt-1.5 flex items-center justify-between font-mono text-sm font-bold text-gray-900">
                #{s} <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
            ))}
          </MockCard>
          <div className="flex">
            <MockButton>{t("mockCheckOut")}</MockButton>
          </div>
        </>
      ),
    },
    {
      Icon: Wallet,
      title: t("flow5Title"),
      body: onsite ? t("flow5BodyOnsite") : t("flow5Body"),
      mock: (
        <MockCard>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t("mockThisMonth")}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {[
              [12, t("mockBookings")],
              [21, t("mockBagsLabel")],
            ].map(([n, label]) => (
              <p key={String(label)} className="flex items-baseline gap-2 rounded-xl bg-gray-50 px-2.5 py-1.5">
                <span className="text-xl id-display text-gray-900">{n}</span>
                <span className="text-xs text-gray-500">{label}</span>
              </p>
            ))}
          </div>
          <div className="mt-2 flex h-10 items-end gap-1">
            {[30, 55, 40, 70, 50, 85, 65].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-brand-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </MockCard>
      ),
    },
  ];

  const panel = [
    { Icon: CalendarCheck, title: t("panelBookingsTitle"), body: t("panelBookingsBody") },
    { Icon: ClipboardList, title: t("panelSealsTitle"), body: t("panelSealsBody") },
    { Icon: TrendingUp, title: t("panelEarningsTitle"), body: t("panelEarningsBody") },
    { Icon: Settings, title: t("panelSettingsTitle"), body: t("panelSettingsBody") },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 pb-10 pt-12 text-center sm:px-6 md:pt-20">
        <p className="id-eyebrow text-xs text-brand-700">{t("howEyebrow")}</p>
        <h1 className="id-display mx-auto mt-3 max-w-3xl text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          {t("howTitle")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">{t("howSubtitle")}</p>
      </section>

      <section className="px-4 py-10 sm:px-6 md:py-16">
        <ol className="mx-auto flex max-w-5xl flex-col gap-14 md:gap-20">
          {steps.map(({ Icon, title, body, mock, wide }, i) => (
            <li key={title} className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
              <div className={i % 2 === 1 ? "md:order-2" : ""}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon size={22} className="text-brand-600" />
                </div>
                <h2 className="mt-4 text-2xl id-display tracking-tight sm:text-3xl">{title}</h2>
                <p className="mt-3 text-base leading-relaxed text-gray-600">{body}</p>
              </div>
              <div className={i % 2 === 1 ? "md:order-1" : ""}>
                {wide ? mock : <PhoneMock>{mock}</PhoneMock>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-gray-50 px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="id-display text-center text-3xl tracking-tight sm:text-4xl">{t("panelTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">{t("panelSubtitle")}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {panel.map(({ Icon, title, body }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icon size={22} />
                </span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <h2 className="id-display text-3xl tracking-tight sm:text-4xl">{t("finalTitle")}</h2>
          <p className="text-gray-600">{t("finalBody")}</p>
          <Link href="/esnaf#kayit" className="btn-ui btn-ui-lg btn-ui-primary">
            {t("finalCta")}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
