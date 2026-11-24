import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card, CenterMessage, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, formatMoney } from "@/lib/format";
import { usePartnerEarnings } from "@/lib/queries";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { PartnerInsightCharts } from "@/components/PartnerInsightCharts";

/**
 * Esnaf kazanci. Tutarlar sunucuda komisyon dusulmus esnaf payidir; istemci
 * hicbir oran uygulamaz, yalnizca yazar.
 */
export default function PartnerEarningsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const query = usePartnerEarnings();
  const data = query.data;
  const commissionPct = data ? Math.round(data.commissionRate * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("earnings.title")} />

      <StaleQueryBanner query={query} />

      {query.isLoading ? (
        <Loading />
      ) : !data ? (
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
                <AppText variant="caption">{t("earnings.basis")}</AppText>
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
              {/* Web kazanc sayfasinin grafikleri; eski sunucu `insights` gondermez. */}
              {data.insights ? <PartnerInsightCharts insights={data.insights} /> : null}
              <AppText variant="label">{t("earnings.recent", { count: data.history.length })}</AppText>
            </View>
          }
          ListEmptyComponent={<AppText variant="caption">{t("earnings.empty")}</AppText>}
          renderItem={({ item, index }) => {
            const at = item.collectedAt ?? item.createdAt;
            const when = at ? formatDayTime(at) : item.date;
            const amount = formatMoney(item.amount);
            const guest = item.guestName || t("earnings.guestFallback");
            const rowStyle = [
              styles.row,
              index === 0 && styles.rowFirst,
              index === data.history.length - 1 && styles.rowLast,
              index > 0 && styles.rowDivider,
            ];
            const content = (
              <>
                <View style={{ flex: 1 }}>
                  {/* Eski sunucu misafir adini gondermez: o zaman yalnizca saat yazilir. */}
                  {item.bookingId ? <AppText variant="bodyMedium" numberOfLines={1}>{guest}</AppText> : null}
                  <AppText variant={item.bookingId ? "caption" : "body"}>{when}</AppText>
                </View>
                <AppText variant="bodyMedium" style={{ fontFamily: fonts.bodySemibold, fontVariant: ["tabular-nums"] }}>
                  {amount}
                </AppText>
                {item.bookingId ? <ChevronRight size={18} color={colors.inkMuted} /> : null}
              </>
            );
            const bookingId = item.bookingId;
            // Satir kasadaki makbuzla eslestirilebilsin: rezervasyon detayina gider.
            return bookingId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("earnings.rowA11y", { guest, when, amount })}
                onPress={() => router.push(`/partner/${bookingId}`)}
                style={rowStyle}
              >
                {content}
              </Pressable>
            ) : (
              <View style={rowStyle}>{content}</View>
            );
          }}
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
    gap: space.sm,
    minHeight: 52,
    paddingVertical: space.sm,
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
