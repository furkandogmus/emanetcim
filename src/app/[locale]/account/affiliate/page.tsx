import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import Money from "@/components/common/Money";
import { getSiteBaseUrl } from "@/lib/site-base-url";
import { formatInstant } from "@/lib/format-datetime";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { formatDecimal } from "@/lib/currency";
import { affiliateService } from "@/services/AffiliateService";

/**
 * Araci paneli: link, QR, sayaclar ve rezervasyon listesi. Misafirin kisisel
 * bilgisi YOK -- servis yalnizca tarih, dukkan ve tutar secer.
 */
export default async function AffiliatePanelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login?callbackUrl=/${locale}/account/affiliate`);
  const t = await getTranslations("Affiliate");
  const panel = await affiliateService.getPanelForUser(session.user.id);

  if (!panel) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-xl id-surface p-6">
          <h1 className="text-2xl id-display text-gray-900">{t("panelTitle")}</h1>
          <p className="mt-3 text-gray-600">{t("panelNone")}</p>
          <Link href="/affiliates" className="btn-ui btn-ui-primary mt-6 inline-flex">{t("panelApply")}</Link>
        </div>
      </div>
    );
  }

  const link = `${getSiteBaseUrl()}/r/${panel.code}`;
  const qr = panel.status === "active" ? await QRCode.toDataURL(link, { width: 240, margin: 2 }) : null;
  const dateLocale = bcp47ForUiLocale(locale);
  const s = panel.stats;

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl flex flex-col gap-6">
        <div>
          <h1 className="text-3xl id-display text-gray-900">{t("panelTitle")}</h1>
          <p className="mt-1 text-gray-600">{panel.displayName}</p>
        </div>

        <section className="id-surface p-6 flex flex-col md:flex-row gap-6 items-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- veri URL'si, optimize edilecek bir sey yok
            <img src={qr} alt={t("panelQrAlt")} width={160} height={160} className="rounded-xl" />
          ) : null}
          <div className="flex-1">
            <p className="text-xs id-eyebrow text-gray-500">{t("panelLink")}</p>
            <p className="mt-1 break-all font-mono text-lg text-gray-900" data-testid="affiliate-link">{link}</p>
            <p className="mt-2 text-sm text-gray-600">
              {panel.status === "active" ? t("panelRates", { commission: panel.commissionRate, discount: panel.guestDiscountRate }) : t("panelInactive")}
            </p>
            <p className="mt-2 text-xs text-gray-500">{t("panelShareTip")}</p>
          </div>
        </section>

        <dl className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            [t("statClicks"), s.clicks],
            [t("statBookings"), s.bookings],
            [t("statCompleted"), s.completedBookings],
            [t("statEarned"), <Money key="e" amount={s.earned} />],
            [t("statUnpaid"), <Money key="u" amount={s.unpaid} />],
          ].map(([label, value], i) => (
            <div key={i} className="id-surface p-4">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="mt-1 text-xl id-display text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="id-surface p-6">
          <h2 className="text-lg id-display text-gray-900">{t("panelBookings")}</h2>
          {panel.bookings.length === 0 ? <p className="mt-3 text-sm text-gray-500">{t("panelNoBookings")}</p> : null}
          <ul className="mt-3 divide-y divide-gray-100">
            {panel.bookings.map((b, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="text-gray-900">
                  {formatInstant(b.date, dateLocale, { day: "2-digit", month: "short", year: "numeric" })} · {b.shopName}
                </span>
                <span className="text-gray-600">
                  <Money amount={b.amount} /> ·{" "}
                  {b.commission != null
                    ? t(b.commissionPaid ? "panelCommissionPaid" : "panelCommissionUnpaid", { amount: formatDecimal(b.commission, dateLocale, 2) })
                    : b.cancelled
                      ? t("panelCancelled")
                      : t("panelPending")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
