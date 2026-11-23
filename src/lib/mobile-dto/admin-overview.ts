import { toMobileBookingSummary } from "./booking";

type AdminOverviewSource = Awaited<ReturnType<import("@/services/AdminOverviewService").AdminOverviewService["overview"]>>;

/** `admin/overview`. Son rezervasyonlar ozet DTO'sunu tasir; misafir adi yoksa e-posta. */
type AppUsersSource = Awaited<
  ReturnType<(typeof import("@/services/MobileInstallService"))["mobileInstallService"]["activeCounts"]>
>;

export function toMobileAdminOverview(o: AdminOverviewSource, appUsers: AppUsersSource) {
  return {
    series: o.series,
    today: o.today,
    attention: o.attention,
    totals: o.totals,
    /** Uygulamayi acan tekil kisi (`MobileInstall`), kayan 1/7/30 gun. */
    appUsers: {
      day: appUsers.day,
      week: appUsers.week,
      month: appUsers.month,
      total: appUsers.total,
      signedInMonth: appUsers.signedInMonth,
    },
    recent: o.recent.map((b) => ({
      ...toMobileBookingSummary(b),
      guestName: b.guest?.name || b.guestEmail || "",
      createdAt: b.createdAt.toISOString(),
    })),
  };
}
