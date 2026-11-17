import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, formatMoney } from "@/lib/format";
import { usePartnerEarnings } from "@/lib/queries";
import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * Esnaf kazanci. Tutarlar sunucuda komisyon dusulmus esnaf payidir; istemci
 * hicbir oran uygulamaz, yalnizca yazar.
 */
export default function PartnerEarningsScreen() {
  const { t } = useTranslation();
  const query = usePartnerEarnings();
  const data = query.data;
  const commissionPct = data ? Math.round(data.commissionRate * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("earnings.title")}</AppText>
        <View style={{ width: 44 }} />
      </View>

      {query.isLoading ? (
        <Loading />
      ) : query.isError || !data ? (
        <CenterMessage
          title={errorMessage(query.error, "earnings")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={data.history}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            <View style={{ gap: space.lg }}>
              {/* Duz turuncu kart ekrandaki her seyle yarisiyordu: rakam kendi buyuklugunden ses alsin. */}
              <Card style={styles.totalCard}>
                <AppText variant="label">{t("earnings.total")}</AppText>
                <AppText style={styles.total}>{formatMoney(data.totalBalance)}</AppText>
                <View style={styles.todayRow}>
                  <AppText variant="caption">{t("earnings.today")}</AppText>
                  <AppText variant="bodyMedium" style={{ fontVariant: ["tabular-nums"] }}>
                    {formatMoney(data.todayEarnings)}
                  </AppText>
                </View>
              </Card>
              {commissionPct > 0 ? (
                <Banner
                  tone="warning"
                  title={t("earnings.commissionTitle", { pct: commissionPct })}
                  body={t("earnings.commissionBody", { pct: commissionPct, share: 100 - commissionPct })}
                />
              ) : (
                <Banner title={t("earnings.noCommissionTitle")} body={t("earnings.noCommissionBody")} />
              )}
              <AppText variant="label">{t("earnings.recent", { count: data.history.length })}</AppText>
            </View>
          }
          ListEmptyComponent={<AppText variant="caption">{t("earnings.empty")}</AppText>}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.row,
                index === 0 && styles.rowFirst,
                index === data.history.length - 1 && styles.rowLast,
                index > 0 && styles.rowDivider,
              ]}
            >
              <AppText variant="body" style={{ flex: 1 }}>
                {item.createdAt ? formatDayTime(item.createdAt) : item.date}
              </AppText>
              <AppText variant="bodyMedium" style={{ fontFamily: fonts.bodySemibold, fontVariant: ["tabular-nums"] }}>
                {formatMoney(item.amount)}
              </AppText>
            </View>
          )}
          ListFooterComponent={
            // Yalnizca dukkanda tahsilatta dogru; online odemede para platformdan gelir.
            commissionPct === 0 ? (
              <AppText variant="caption" style={{ marginTop: space.lg }}>
                {t("earnings.footnote")}
              </AppText>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  content: { padding: space.xl },
  totalCard: { gap: space.xs },
  total: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, color: colors.ink, fontVariant: ["tabular-nums"] },
  todayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Islemler tek kartta: satirlar kenarlarini paylasir, ilk ve son kose yuvarlanir.
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  rowFirst: { marginTop: space.sm, borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  rowDivider: { borderTopWidth: 1 },
});
