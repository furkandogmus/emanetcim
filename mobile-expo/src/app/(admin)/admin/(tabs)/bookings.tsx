import { memo, useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { LuggageTag } from "@/components/Illustrations";
import { LoadMoreFooter } from "@/components/LoadMoreFooter";
import { SearchBox } from "@/components/SearchBox";
import { StatusBadge } from "@/components/StatusBadge";
import { AppText, Button, CenterMessage, Chip, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, formatMoney } from "@/lib/format";
import { flattenPages } from "@/lib/paging";
import { useAdminBookingCounts, useAdminBookings } from "@/lib/queries";
import type { AdminBookingFilter, AdminBookingRow } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { isBlockingError } from "@/lib/query-view";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";

const FILTERS: AdminBookingFilter[] = ["overdue", "inStorage", "arrivals", "pickups", "upcoming", "noShow", "all"];
const DAY = 24 * 60 * 60 * 1000;

/**
 * Destek hattinin ekrani: misafirin okudugu bilet kodu, adi, e-postasi ya da dukkan
 * adiyla arar; cipler sahadaki durumlara gore suzer. Genel bakistaki sayilar
 * `?filter=` ile buraya acilir.
 */
export default function AdminBookingsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ filter?: string; q?: string }>();
  const [filter, setFilter] = useState<AdminBookingFilter>(
    FILTERS.includes(params.filter as AdminBookingFilter) ? (params.filter as AdminBookingFilter) : "all",
  );
  const [q, setQ] = useState(params.q ?? "");

  // Genel bakistan farkli bir filtreyle tekrar gelinirse sekme ekrani yeniden kurulmaz;
  // parametre degistiginde (efekt yerine render sirasinda) secimi guncelle.
  const [seenParam, setSeenParam] = useState(params.filter);
  if (params.filter !== seenParam) {
    setSeenParam(params.filter);
    if (FILTERS.includes(params.filter as AdminBookingFilter)) setFilter(params.filter as AdminBookingFilter);
  }
  // Kullanici kartindan gelen arama metni: kutu `key` ile yeniden kurulur, metin dolu acilir.
  const [seenQ, setSeenQ] = useState(params.q);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    setQ(params.q ?? "");
  }


  const query = useAdminBookings(filter, q);
  const rows = flattenPages(query.data, (p) => p.bookings);
  const counts = useAdminBookingCounts().data;
  // Gecikme gunu verinin cekildigi ana gore: sekme acik kaldikca donmaz, render saf kalir.
  const now = query.dataUpdatedAt;
  const renderRow = useCallback(
    ({ item, index }: { item: AdminBookingRow; index: number }) => (
      <Row booking={item} now={now} first={index === 0} last={index === rows.length - 1} />
    ),
    [now, rows.length],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="title">{t("admin.tabs.bookings")}</AppText>
        <SearchBox key={params.q ?? ""} initialValue={params.q ?? ""} placeholder={t("admin.searchPlaceholder")} onSearch={setQ} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              soft
              selected={f === filter}
              onPress={() => {
                setFilter(f);
                // Parametre de guncellenmeli: yoksa genel bakistan ayni filtreye tekrar
                // gelindiginde degisiklik gorulmez ve cip eski secimde kalir.
                router.setParams({ filter: f });
              }}
              label={counts ? `${t(`admin.filters.${f}`)} ${counts[f]}` : t(`admin.filters.${f}`)}
            />
          ))}
        </ScrollView>
      </View>

      <StaleQueryBanner query={query} />

      {query.isLoading ? (
        <Loading />
      ) : isBlockingError(query) ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, rows.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <CenterMessage
              art={<LuggageTag size={64} />}
              title={q.trim().length >= 2 ? t("admin.noSearchResult") : t("admin.noBookingsInFilter")}
            />
          }
          ListFooterComponent={
            <LoadMoreFooter
              hasMore={!!query.hasNextPage}
              loading={query.isFetchingNextPage}
              failed={query.isFetchNextPageError}
              onPress={() => void query.fetchNextPage()}
            />
          }
          renderItem={renderRow}
        />
      )}
    </SafeAreaView>
  );
}

const Row = memo(function Row({
  booking: b,
  now,
  first,
  last,
}: {
  booking: AdminBookingRow;
  now: number;
  first: boolean;
  last: boolean;
}) {
  const { t } = useTranslation();
  // Kirmizi uyari yalnizca valizi dukkanda olanlara: gelmeyenler (gelmedi) sessiz.
  const lateMs = b.status === "CHECKED_IN" ? now - new Date(b.checkOutTime).getTime() : 0;
  const lateDays = Math.floor(lateMs / DAY);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/admin/booking/${b.id}`)}
      style={({ pressed }) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        !first && styles.rowDivider,
        pressed && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleLine}>
          <AppText variant="mono" style={styles.code}>
            {b.id.slice(0, 8).toUpperCase()}
          </AppText>
          <AppText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
            {b.guestName || t("partner.guest")}
          </AppText>
        </View>
        <AppText variant="caption" numberOfLines={1} style={{ fontSize: 13 }}>
          {b.shopName}
        </AppText>
        <AppText variant="caption" style={{ fontSize: 13 }}>
          {formatDayTime(b.checkInTime)}
        </AppText>
        {/* Bir gunden kisa gecikme de etiketsiz kalmasin. */}
        {lateMs > 0 ? (
          <AppText variant="label" style={{ color: colors.danger, fontSize: 12 }}>
            {lateDays >= 1 ? t("admin.lateDays", { count: lateDays }) : t("admin.lateToday")}
          </AppText>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <AppText variant="bodyMedium" style={{ fontFamily: fonts.bodySemibold, fontVariant: ["tabular-nums"] }}>
          {formatMoney(b.totalPrice)}
        </AppText>
        <StatusBadge status={b.status} cancelReason={b.cancelReason} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.xl, paddingBottom: space.md, gap: space.md },
  chips: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.md },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  // Satirlar tek kartta: kenarlar paylasilir, ilk ve son kose yuvarlanir.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  rowDivider: { borderTopWidth: 1 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  code: { fontSize: 13, color: colors.inkSecondary, letterSpacing: 0.5 },
});
