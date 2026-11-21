import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AlertCircle, BadgeCheck, ChevronRight, Phone, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { MapSnippet } from "@/components/Illustrations";
import { SearchBox } from "@/components/SearchBox";
import { AppText, Button, CenterMessage, Chip, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { telUrl } from "@/lib/phone";
import { useAdminOverview, useAdminShops } from "@/lib/queries";
import type { AdminShop } from "@/lib/types";
import { formatRating } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";

/** Doluluk bu oranin ustundeyse cubuk turuncu: o dukkana yeni rezervasyon yonlendirmek riskli. */
const BUSY = 0.8;

type ShopFilter = "all" | "issues" | "inactive" | "test";

const FILTERS: Record<ShopFilter, (s: AdminShop) => boolean> = {
  all: (s) => !s.isTest,
  issues: (s) => !s.isTest && s.issues.length > 0,
  inactive: (s) => !s.isTest && !s.isActive,
  test: (s) => s.isTest,
};

function matches(s: AdminShop, q: string) {
  const term = q.trim().toLocaleLowerCase("tr");
  return !term || [s.name, s.place, s.phone].some((v) => v.toLocaleLowerCase("tr").includes(term));
}

export default function AdminShopsScreen() {
  const { t } = useTranslation();
  const query = useAdminShops();
  const pending = useAdminOverview().data?.attention.pendingApplications ?? 0;
  const [filter, setFilter] = useState<ShopFilter>("all");
  const [q, setQ] = useState("");
  const all = query.data ?? [];
  // Talep testi noktalari valiz ALMIYOR: dolulukla ayni listede durunca gercek dukkanlarla
  // karisiyordu. Sayim ve toplam yalnizca hizmetteki dukkanlar.
  const real = all.filter((s) => !s.isPrelaunch);
  const live = real.filter((s) => s.isActive && !s.isTest);
  const shops = real.filter((s) => FILTERS[filter](s) && matches(s, q));
  // Talep testi noktalari yalnizca "Tumu" altinda ve aramayla; filtreler gercek dukkan icin.
  const prelaunch = filter === "all" ? all.filter((s) => s.isPrelaunch && matches(s, q)) : [];
  const stored = live.reduce((a, s) => a + s.bagsInStorage, 0);
  const count = (f: ShopFilter) => real.filter(FILTERS[f]).length;
  const sections = [
    { key: "live", title: prelaunch.length > 0 ? t("admin.shopsLive") : null, data: shops },
    ...(prelaunch.length > 0 ? [{ key: "prelaunch", title: t("admin.shopsPrelaunch"), data: prelaunch }] : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="title">{t("admin.tabs.shops")}</AppText>
        {query.data ? (
          <AppText variant="caption">{t("admin.shopsSummary", { count: live.length, bags: stored })}</AppText>
        ) : null}
        <SearchBox placeholder={t("admin.shopSearchPlaceholder")} onSearch={setQ} />
      </View>
      {query.data ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
          {(Object.keys(FILTERS) as ShopFilter[]).map((f) => {
            const n = count(f);
            if (f === "test" && n === 0) return null;
            return (
              <Chip
                key={f}
                label={`${t(`admin.shopFilter.${f}`)} ${n}`}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            );
          })}
        </ScrollView>
      ) : null}

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
          contentContainerStyle={[styles.list, shops.length + prelaunch.length === 0 && { flex: 1 }]}
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
          ListEmptyComponent={
            <CenterMessage art={<MapSnippet width={112} />} title={t(q || filter !== "all" ? "admin.noShopsMatch" : "admin.noShops")} />
          }
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
          <IconButton label={t("admin.callShop")} onPress={() => void Linking.openURL(telUrl(s.phone, s.whatsapp)).catch(() => undefined)}>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.name}
      onPress={() => router.push(`/admin/shop/${s.id}`)}
      style={({ pressed }) => [styles.card, !s.isActive && styles.inactiveCard, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleLine}>
            <AppText variant="heading" numberOfLines={2} style={{ flexShrink: 1 }}>
              {s.name}
            </AppText>
            {s.isVerified ? <BadgeCheck size={16} color={colors.accent} accessibilityLabel={t("admin.verified")} /> : null}
          </View>
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
          <IconButton label={t("admin.callShop")} onPress={() => void Linking.openURL(telUrl(s.phone, s.whatsapp)).catch(() => undefined)}>
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

      {!s.isActive || s.isTest || s.issues.length > 0 ? (
        <View style={styles.tags}>
          {!s.isActive ? <Tag label={t("admin.inactive")} warn /> : null}
          {s.isTest ? <Tag label={t("admin.testRecord")} /> : null}
          {s.issues
            .filter((i) => i !== "inactive")
            .map((i) => (
              <Tag key={i} label={t(`admin.shopIssue.${i}`)} warn={i !== "noPhoto"} />
            ))}
        </View>
      ) : null}

      <View style={styles.today}>
        <AppText variant="caption" style={{ fontSize: 13, flex: 1 }}>
          {t("admin.shopToday", { arrivals: s.arrivalsToday, pickups: s.pickupsToday })}
        </AppText>
        <ChevronRight size={16} color={colors.inkMuted} />
      </View>
    </Pressable>
  );
}

function Tag({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <View style={[styles.tag, warn && styles.tagWarn]}>
      {warn ? <AlertCircle size={12} color={colors.accent} /> : null}
      <AppText variant="caption" style={[styles.tagText, warn && { color: colors.accent }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.xl, paddingBottom: space.md, gap: space.sm },
  chips: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.md },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  inactiveCard: { borderStyle: "dashed" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tagWarn: { flexDirection: "row", alignItems: "center", gap: 4, borderColor: colors.brand, backgroundColor: colors.brandSoft },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
  sectionTitle: { marginTop: space.md },
  prelaunchCard: { backgroundColor: colors.surfaceMuted, borderStyle: "dashed" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  today: { flexDirection: "row", alignItems: "center", paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
