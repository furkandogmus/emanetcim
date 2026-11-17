import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { ChevronRight, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { useAdminStats } from "@/lib/queries";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function AdminDashboardScreen() {
  const { t } = useTranslation();
  const query = useAdminStats();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="title">{t("admin.title")}</AppText>
        <IconButton label={t("home.profile")} onPress={() => router.push("/profile")}>
          <User size={20} color={colors.ink} />
        </IconButton>
      </View>

      {query.isLoading ? (
        <Loading />
      ) : query.isError || !query.data ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
        >
          {/* Tek ana rakam (ciro) buyuk; adetler ayni kartta ikincil. Ayri ayri esit kartlar sablon gibiydi. */}
          <Card style={{ gap: space.lg }}>
            <View style={{ gap: 2 }}>
              <AppText variant="label">{t("admin.totalRevenue")}</AppText>
              <AppText style={styles.revenue}>{formatMoney(query.data.totalRevenue)}</AppText>
            </View>
            <View style={styles.counts}>
              <Count label={t("admin.totalBookings")} value={query.data.totalBookings} />
              <View style={styles.countRule} />
              <Count label={t("admin.totalPartners")} value={query.data.totalPartners} />
            </View>
          </Card>

          <View style={styles.group}>
            <ActionRow
              label={t("admin.pendingApplications")}
              value={query.data.pendingApplications}
              href="/admin/applications"
            />
            <View style={styles.divider} />
            <ActionRow label={t("admin.unreadMessages")} value={query.data.unreadMessages} href="/admin/messages" />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ActionRow({ label, value, href }: { label: string; value: number; href: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <AppText variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </AppText>
      {/* Bekleyen is varsa sayi turuncu rozet; yoksa sessiz gri. */}
      <View style={[styles.badge, value > 0 && styles.badgeHot]}>
        <AppText variant="label" style={[styles.badgeText, value > 0 && { color: colors.white }]}>
          {value}
        </AppText>
      </View>
      <ChevronRight size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText style={styles.count}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.xl,
    paddingBottom: space.lg,
  },
  content: { padding: space.xl, paddingTop: space.sm, gap: space.md },
  revenue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, color: colors.ink, fontVariant: ["tabular-nums"] },
  counts: { flexDirection: "row", paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.border },
  countRule: { width: 1, backgroundColor: colors.border, marginHorizontal: space.lg },
  count: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, fontVariant: ["tabular-nums"] },
  group: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: colors.border },
  action: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.lg },
  badge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  badgeHot: { backgroundColor: colors.accent },
  badgeText: { fontVariant: ["tabular-nums"] },
});
