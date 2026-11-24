import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { BarList } from "@/components/BarList";
import { AppText, Card } from "@/components/ui";
import { useAdminPrelaunch } from "@/lib/queries";
import { space } from "@/theme/tokens";

/** Sehir listesi uzayinca ilk 15 sehir cubukla, kalani sayilmaz: karar ilk sehirlerden cikar. */
const CITY_BARS = 15;

/**
 * Talep testi sonuclari (salt okuma): hangi noktada kac kisi "acilinca haber ver" dedi.
 * Kirilim web `/admin/prelaunch` ile ortak (`PrelaunchInterestService.adminReport`).
 * Iki sinyal noktada ayri okunur: tek tik ilginin genisligi, e-posta niyetin derinligi.
 */
export default function AdminPrelaunchScreen() {
  const { t } = useTranslation();
  const query = useAdminPrelaunch();
  const data = query.data;

  return (
    <AdminOpsScreen title={t("adminPrelaunch.title")} query={query}>
      {data ? (
        <>
          <AppText variant="caption" style={{ fontSize: 13 }}>
            {t("adminPrelaunch.intro")}
          </AppText>
          <AppText variant="caption" style={{ fontSize: 13 }}>
            {t("adminPrelaunch.silent", { count: data.silentCount, total: data.totalPoints })}
          </AppText>

          <Card style={{ gap: space.md }}>
            <SectionTitle>{t("adminPrelaunch.byCity")}</SectionTitle>
            {data.cities.length === 0 ? (
              <AppText variant="caption">{t("adminPrelaunch.empty")}</AppText>
            ) : (
              <BarList items={data.cities.slice(0, CITY_BARS).map((c) => ({ key: c.city, label: c.city, value: c.count }))} />
            )}
          </Card>

          <View style={{ gap: space.sm }}>
            <SectionTitle>{t("adminPrelaunch.byPoint")}</SectionTitle>
            {data.points.length === 0 ? (
              <AppText variant="caption">{t("adminPrelaunch.empty")}</AppText>
            ) : (
              data.points.map((p) => (
                <View key={p.shopId} style={opsStyles.row}>
                  <View style={opsStyles.rowTop}>
                    <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                      {p.shopName}
                    </AppText>
                  </View>
                  <AppText variant="caption" style={opsStyles.meta}>
                    {[p.city, p.district].filter(Boolean).join(" / ") || "—"}
                  </AppText>
                  <AppText variant="caption" style={opsStyles.meta}>
                    {t("adminPrelaunch.counts", { wants: p.wantCount, emails: p.interestCount })}
                  </AppText>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </AdminOpsScreen>
  );
}
