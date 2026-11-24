import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { opsStyles } from "@/components/AdminOps";
import { LoadMoreFooter } from "@/components/LoadMoreFooter";
import { SearchBox } from "@/components/SearchBox";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { TonePill } from "@/components/TonePill";
import { AppText, Banner, Button, CenterMessage, Chip, Loading } from "@/components/ui";
import type { Tone } from "@/lib/admin-system";
import { errorMessage } from "@/lib/errors";
import { formatDayTime } from "@/lib/format";
import { flattenPages } from "@/lib/paging";
import { useAdminNotificationLogs } from "@/lib/queries";
import { isBlockingError } from "@/lib/query-view";
import type { AdminNotificationLog } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

/** Saglayici olaylarindan gelen durumlar (`webhooks/resend`) ve gonderim sonucu. */
function statusTone(s: string): Tone {
  if (s === "SENT" || s === "DELIVERED") return "ok";
  if (s === "SKIPPED") return "muted";
  return "danger";
}

/**
 * Bildirim defteri (salt okuma): "bu misafire e-posta gitti mi?" sorusunun cevabi.
 * Suzgec web `/admin/notifications` ile ortak (`NotificationLogService`). Govde
 * varsayilan kapali: misafirin adini ve rezervasyon kodunu tasiyor.
 */
export default function AdminNotificationLogScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const onSearch = useCallback((v: string) => setQ(v), []);
  const query = useAdminNotificationLogs({ status, type, q });
  const items = flattenPages(query.data, (p) => p.items);
  // Secenekler suzulmemis ilk sayfayla gelir; suzgec degisince kaybolmasin diye ilk gorulen tutulur.
  const [facets, setFacets] = useState<{ types: string[]; statuses: string[]; failedCount: number } | null>(null);
  const first = query.data?.pages[0]?.facets;
  if (first && !facets) setFacets(first);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("adminNotificationLog.title")} />
      <View style={styles.search}>
        <SearchBox placeholder={t("adminNotificationLog.searchPlaceholder")} onSearch={onSearch} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        <Chip label={t("adminNotificationLog.allStatuses")} selected={status === null} onPress={() => setStatus(null)} soft />
        {(facets?.statuses ?? []).map((s) => (
          <Chip
            key={s}
            label={t(`adminNotificationLog.status.${s}`, { defaultValue: s })}
            selected={status === s}
            onPress={() => setStatus(s)}
            soft
          />
        ))}
      </ScrollView>
      {facets && facets.types.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
          <Chip label={t("adminNotificationLog.allTypes")} selected={type === null} onPress={() => setType(null)} soft />
          {facets.types.map((ty) => (
            <Chip key={ty} label={ty} selected={type === ty} onPress={() => setType(ty)} soft />
          ))}
        </ScrollView>
      ) : null}
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : isBlockingError(query) ? (
        <CenterMessage
          title={errorMessage(query.error, "adminNotificationLog")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[styles.list, items.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => query.refetch()}
              tintColor={colors.accent}
            />
          }
          ListHeaderComponent={
            facets && facets.failedCount > 0 && status === null ? (
              <Banner tone="warning" body={t("adminNotificationLog.failedCount", { count: facets.failedCount })} />
            ) : null
          }
          ListEmptyComponent={<CenterMessage title={t("adminNotificationLog.empty")} />}
          ListFooterComponent={
            <LoadMoreFooter
              hasMore={!!query.hasNextPage}
              loading={query.isFetchingNextPage}
              failed={query.isFetchNextPageError}
              onPress={() => void query.fetchNextPage()}
            />
          }
          renderItem={({ item }) => <LogRow log={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function LogRow({ log: l }: { log: AdminNotificationLog }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={opsStyles.row}>
      <View style={opsStyles.rowTop}>
        <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
          {l.recipient}
        </AppText>
        <TonePill tone={statusTone(l.status)} label={t(`adminNotificationLog.status.${l.status}`, { defaultValue: l.status })} />
      </View>
      <AppText variant="caption" style={opsStyles.meta} numberOfLines={1}>
        {l.type} · {formatDayTime(l.createdAt)}
      </AppText>
      {l.subject ? (
        <AppText variant="caption" numberOfLines={open ? undefined : 1}>
          {l.subject}
        </AppText>
      ) : null}
      {l.error ? (
        <AppText variant="caption" style={{ color: colors.danger }} numberOfLines={open ? undefined : 2}>
          {l.error}
        </AppText>
      ) : null}
      {open ? (
        <AppText variant="caption" style={styles.body} selectable>
          {l.content}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen((v) => !v)}>
          <AppText variant="label" style={{ color: colors.accent }}>
            {open ? t("adminNotificationLog.hideBody") : t("adminNotificationLog.showBody")}
          </AppText>
        </Pressable>
        {l.bookingId ? (
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push(`/admin/booking/${l.bookingId}`)}>
            <AppText variant="label" style={{ color: colors.accent }}>
              {t("adminNotificationLog.openBooking")}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  search: { paddingHorizontal: space.xl, paddingBottom: space.sm },
  // Yatay ScrollView varsayilan flexGrow ile listenin alanini paylasmasin.
  chipBar: { flexGrow: 0 },
  chips: { paddingHorizontal: space.xl, paddingBottom: space.sm, gap: space.sm },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.sm },
  body: { padding: space.sm, borderRadius: 8, backgroundColor: colors.surfaceMuted, fontSize: 13 },
  actions: { flexDirection: "row", gap: space.lg, paddingTop: space.xs },
});
