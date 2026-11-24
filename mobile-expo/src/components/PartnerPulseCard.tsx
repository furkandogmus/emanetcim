import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { usePartnerDashboard } from "@/lib/queries";
import { dashboardAccess } from "@/lib/shop-access";
import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * Esnaf ana ekranindaki gunluk ozet: web panelinin "gunluk enstantane" blogu.
 * Dukkan secimi kartin disinda (`ShopSwitcher`); kart secili dukkanin rakamlarini gosterir.
 * Rakamlar sunucudan (`partner/dashboard`), burada hesap yok. Hata listeyi
 * engellemez; tek satir ve dokununca yeniden dener.
 */
export function PartnerPulseCard() {
  const { t } = useTranslation();
  const query = usePartnerDashboard();

  if (query.isLoading) {
    return (
      <Card style={[styles.card, styles.placeholder]}>
        <ActivityIndicator color={colors.accent} accessibilityLabel={t("common.loading")} />
      </Card>
    );
  }

  if (!query.data) {
    return (
      <Pressable accessibilityRole="button" onPress={() => query.refetch()} style={styles.errorRow}>
        <AppText variant="caption">{t("pulse.failed")}</AppText>
      </Pressable>
    );
  }

  const d = query.data;
  // Personel kazanc gormez (sunucu da sifir gonderir); yalniz gunluk sayilar.
  const staff = dashboardAccess(d) === "staff";
  // Ay ici kazanc gecen ayin TAMAMIYLA kiyaslaniyor; bu ay henuz kazanc yokken "%100 az"
  // hicbir sey soylemiyor, esnafi da korkutuyor. O durumda rozet gizli.
  const pct = d.monthChangePct != null && d.monthNet > 0 ? d.monthChangePct : null;
  const up = pct != null && pct >= 0;
  const summary = t("pulse.a11y", {
    shop: d.shop.name,
    arrivals: d.todayArrivals,
    pickups: d.todayPickups,
    bags: d.bagsInStorage,
    month: formatMoney(d.monthNet),
  });
  const a11y = staff ? t("shopStaff.pulseA11y", { shop: d.shop.name, arrivals: d.todayArrivals, pickups: d.todayPickups, bags: d.bagsInStorage }) : summary;

  return (
    <Card style={styles.card}>
      <View accessible accessibilityLabel={a11y} style={{ gap: space.md }}>
        <AppText variant="label" numberOfLines={1}>
          {t("pulse.todayLabel")}
        </AppText>

        <View style={styles.stats}>
          <Stat value={d.todayArrivals} label={t("pulse.arrivals")} />
          <View style={styles.statRule} />
          <Stat value={d.todayPickups} label={t("pulse.pickups")} />
          <View style={styles.statRule} />
          <Stat value={d.bagsInStorage} label={t("pulse.inStorage")} emphasis={d.bagsInStorage > 0} />
        </View>

        {d.sourceStats ? (
          <View style={styles.month} accessible accessibilityLabel={`${t("walkIn.statPoster")}: ${d.sourceStats.thisMonth.poster}. ${t("walkIn.statWalkIn")}: ${d.sourceStats.thisMonth.walkIn}`}>
            <SourceStat label={t("walkIn.statPoster")} value={d.sourceStats.thisMonth.poster} prev={t("walkIn.lastMonth", { count: d.sourceStats.lastMonth.poster })} />
            <View style={styles.statRule} />
            <SourceStat label={t("walkIn.statWalkIn")} value={d.sourceStats.thisMonth.walkIn} prev={t("walkIn.lastMonth", { count: d.sourceStats.lastMonth.walkIn })} />
          </View>
        ) : null}

        {staff ? null : (
        <View style={styles.month}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption">{t("pulse.thisMonth")}</AppText>
            <AppText style={styles.monthValue}>{formatMoney(d.monthNet)}</AppText>
            <AppText variant="caption" style={{ fontSize: 12 }}>{t("pulse.collectedBasis")}</AppText>
          </View>
          {pct != null ? (
            <View style={[styles.badge, { backgroundColor: up ? colors.successSoft : colors.dangerSoft }]}>
              {up ? <TrendingUp size={14} color={colors.success} /> : <TrendingDown size={14} color={colors.danger} />}
              <AppText variant="label" style={{ color: up ? colors.success : colors.danger }}>
                {t(up ? "pulse.moreThanLastMonth" : "pulse.lessThanLastMonth", { pct: Math.abs(Math.round(pct)) })}
              </AppText>
            </View>
          ) : null}
        </View>
        )}
      </View>
    </Card>
  );
}

/** Bu ay sayisi + gecen ay satiri; tutar yok (personel de gorur). */
function SourceStat({ label, value, prev }: { label: string; value: number; prev: string }) {
  return (
    <View style={{ flex: 1, gap: 2, paddingHorizontal: space.xs }}>
      <AppText variant="caption" numberOfLines={2} style={{ fontSize: 12 }}>
        {label}
      </AppText>
      <AppText style={styles.monthValue}>{value}</AppText>
      <AppText variant="caption" style={{ fontSize: 12 }}>
        {prev}
      </AppText>
    </View>
  );
}

function Stat({ value, label, emphasis }: { value: number; label: string; emphasis?: boolean }) {
  return (
    <View style={[styles.stat, emphasis && styles.statEmphasis]}>
      <AppText style={[styles.statValue, emphasis && { color: colors.accent }]}>{value}</AppText>
      <AppText variant="caption" numberOfLines={2} style={styles.statLabel}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  placeholder: { height: 168, alignItems: "center", justifyContent: "center" },
  // Uc esit dolu karo yerine ince cizgiyle ayrilmis sayilar: vurgu yalnizca "dukkanda valiz"de.
  stats: { flexDirection: "row", alignItems: "stretch" },
  statRule: { width: 1, backgroundColor: colors.border, marginVertical: space.xs },
  stat: { flex: 1, paddingVertical: space.xs, alignItems: "center", gap: 2 },
  statEmphasis: {},
  statValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink, fontVariant: ["tabular-nums"] },
  monthValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, fontVariant: ["tabular-nums"] },
  statLabel: { textAlign: "center", fontSize: 12, lineHeight: 16 },
  month: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  errorRow: { paddingVertical: space.sm },
});
