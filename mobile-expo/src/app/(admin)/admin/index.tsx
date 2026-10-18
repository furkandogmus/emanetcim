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
          <ActionRow
            label={t("admin.pendingApplications")}
            value={query.data.pendingApplications}
            href="/admin/applications"
          />
          <ActionRow label={t("admin.unreadMessages")} value={query.data.unreadMessages} href="/admin/messages" />
          <View style={styles.grid}>
            <Stat label={t("admin.totalBookings")} value={String(query.data.totalBookings)} />
            <Stat label={t("admin.totalPartners")} value={String(query.data.totalPartners)} />
          </View>
          <Stat label={t("admin.totalRevenue")} value={formatMoney(query.data.totalRevenue)} />
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
      style={({ pressed }) => [styles.action, value > 0 && styles.actionHot, pressed && { opacity: 0.85 }]}
    >
      <AppText variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
        {value}
      </AppText>
      <ChevronRight size={20} color={colors.inkMuted} />
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 24 }}>
        {value}
      </AppText>
    </Card>
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
  grid: { flexDirection: "row", gap: space.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionHot: { borderColor: colors.brandSoftBorder, backgroundColor: colors.brandSoft },
});
