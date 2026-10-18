import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, formatMoney } from "@/lib/format";
import { usePartnerEarnings } from "@/lib/queries";
import { colors, fonts, space } from "@/theme/tokens";

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
              <Card style={styles.totalCard}>
                <AppText variant="label" style={{ color: colors.white, opacity: 0.85 }}>
                  {t("earnings.total")}
                </AppText>
                <AppText variant="display" style={{ color: colors.white }}>
                  {formatMoney(data.totalBalance)}
                </AppText>
                <View style={styles.todayRow}>
                  <AppText variant="caption" style={{ color: colors.white, opacity: 0.85 }}>
                    {t("earnings.today")}
                  </AppText>
                  <AppText variant="bodyMedium" style={{ color: colors.white }}>
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
          renderItem={({ item }) => (
            <View style={styles.row}>
              <AppText variant="body" style={{ flex: 1 }}>
                {item.createdAt ? formatDayTime(item.createdAt) : item.date}
              </AppText>
              <AppText variant="bodyMedium" style={{ fontFamily: fonts.bodySemibold }}>
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
  content: { padding: space.xl, gap: space.sm },
  totalCard: { backgroundColor: colors.accent, borderColor: colors.accent, gap: space.xs },
  todayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
