import { Linking, Pressable, RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Phone, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { MapSnippet } from "@/components/Illustrations";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useAdminOverview, useAdminShops } from "@/lib/queries";
import type { AdminShop } from "@/lib/types";
import { formatRating } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";

/** Doluluk bu oranin ustundeyse cubuk turuncu: o dukkana yeni rezervasyon yonlendirmek riskli. */
const BUSY = 0.8;

export default function AdminShopsScreen() {
  const { t } = useTranslation();
  const query = useAdminShops();
  const pending = useAdminOverview().data?.attention.pendingApplications ?? 0;
  const all = query.data ?? [];
  // Talep testi noktalari valiz ALMIYOR: dolulukla ayni listede durunca gercek dukkanlarla
  // karisiyordu. Sayim ve toplam yalnizca hizmetteki dukkanlar.
  const shops = all.filter((s) => !s.isPrelaunch);
  const prelaunch = all.filter((s) => s.isPrelaunch);
  const stored = shops.reduce((a, s) => a + s.bagsInStorage, 0);
  const sections = [
    { key: "live", title: prelaunch.length > 0 ? t("admin.shopsLive") : null, data: shops },
    ...(prelaunch.length > 0 ? [{ key: "prelaunch", title: t("admin.shopsPrelaunch"), data: prelaunch }] : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="title">{t("admin.tabs.shops")}</AppText>
        {query.data ? (
          <AppText variant="caption">{t("admin.shopsSummary", { count: shops.length, bags: stored })}</AppText>
        ) : null}
      </View>

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => s.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.list, all.length === 0 && { flex: 1 }]}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <AppText variant="label" style={styles.sectionTitle}>
                {section.title}
              </AppText>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            pending > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/admin/applications")}
                style={({ pressed }) => [styles.pending, pressed && { backgroundColor: colors.surfaceMuted }]}
              >
                <AppText variant="bodyMedium" style={{ flex: 1 }}>
                  {t("admin.pendingApplicationsCount", { count: pending })}
                </AppText>
                <ChevronRight size={18} color={colors.inkMuted} />
              </Pressable>
            ) : null
          }
          ListEmptyComponent={<CenterMessage art={<MapSnippet width={112} />} title={t("admin.noShops")} />}
          renderItem={({ item }) => (item.isPrelaunch ? <PrelaunchRow shop={item} /> : <ShopRow shop={item} />)}
        />
      )}
    </SafeAreaView>
  );
}

/** Talep testi noktasi: doluluk ve bugunku hareket yok, cunku valiz almiyor. */
function PrelaunchRow({ shop: s }: { shop: AdminShop }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, styles.prelaunchCard]}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="heading" numberOfLines={1} style={{ color: colors.inkSecondary }}>
            {s.name}
          </AppText>
          <View style={styles.meta}>
            <View style={styles.tag}>
              <AppText variant="caption" style={styles.tagText}>
                {t("admin.noBags")}
              </AppText>
            </View>
            {s.place ? (
              <AppText variant="caption" numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>
                {s.place}
              </AppText>
            ) : null}
          </View>
        </View>
        {s.phone ? (
          <IconButton label={t("admin.callShop")} onPress={() => void Linking.openURL(`tel:${s.phone}`).catch(() => undefined)}>
            <Phone size={18} color={colors.ink} />
          </IconButton>
        ) : null}
      </View>
    </View>
  );
}

function ShopRow({ shop: s }: { shop: AdminShop }) {
  const { t } = useTranslation();
  const ratio = s.capacity > 0 ? Math.min(1, s.bagsInStorage / s.capacity) : 0;
  const busy = ratio >= BUSY;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={1}>
            {s.name}
          </AppText>
          <View style={styles.meta}>
            {s.rating ? (
              <>
                <Star size={12} color={colors.brand} fill={colors.brand} />
                <AppText variant="caption" style={{ fontSize: 13, color: colors.ink }}>
                  {formatRating(s.rating)}
                </AppText>
                {s.place ? (
                  <AppText variant="caption" style={{ fontSize: 13 }}>
                    ·
                  </AppText>
                ) : null}
              </>
            ) : null}
            <AppText variant="caption" numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>
              {s.place}
            </AppText>
          </View>
        </View>
        {s.phone ? (
          <IconButton label={t("admin.callShop")} onPress={() => void Linking.openURL(`tel:${s.phone}`).catch(() => undefined)}>
            <Phone size={18} color={colors.ink} />
          </IconButton>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <View style={styles.barLine}>
          <AppText variant="label">{t("admin.occupancy")}</AppText>
          <AppText variant="label" style={[{ fontVariant: ["tabular-nums"] }, busy && { color: colors.accent }]}>
            {t("admin.bagsOfCapacity", { bags: s.bagsInStorage, capacity: s.capacity })}
          </AppText>
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: s.capacity, now: s.bagsInStorage }}
        >
          <View style={[styles.fill, { width: `${ratio * 100}%` }, busy && { backgroundColor: colors.accent }]} />
        </View>
      </View>

      <View style={styles.today}>
        <AppText variant="caption" style={{ fontSize: 13 }}>
          {t("admin.shopToday", { arrivals: s.arrivalsToday, pickups: s.pickupsToday })}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.xl, paddingBottom: space.lg, gap: 2 },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
  sectionTitle: { marginTop: space.md },
  prelaunchCard: { backgroundColor: colors.surfaceMuted, borderStyle: "dashed" },
  tag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tagText: { fontSize: 12, color: colors.inkSecondary },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  barLine: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.inkSecondary },
  today: { paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
