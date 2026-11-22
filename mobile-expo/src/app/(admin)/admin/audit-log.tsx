import { useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { LoadMoreFooter } from "@/components/LoadMoreFooter";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { AppText, Button, CenterMessage, Chip, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatDayTime } from "@/lib/format";
import { flattenPages } from "@/lib/paging";
import { useAdminAuditLog } from "@/lib/queries";
import { isBlockingError } from "@/lib/query-view";
import type { AdminAuditEntry } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Denetim kaydi (salt okuma): eylem onekiyle ve kullaniciyla suzulur, yeniden
 * eskiye sayfalanir. Sorgu web `/admin/audit-log` ile ortak (`AuditLogService`).
 */
export default function AdminAuditLogScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const userId = params.userId || null;
  const [prefix, setPrefix] = useState<string | null>(null);
  const query = useAdminAuditLog(prefix, userId);
  const entries = flattenPages(query.data, (p) => p.entries);
  // Onekler ilk sayfayla gelir; filtre degisince kaybolmasin diye ilk gorulen liste tutulur.
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const firstPrefixes = query.data?.pages[0]?.prefixes;
  if (firstPrefixes && prefixes.length === 0 && firstPrefixes.length > 0) setPrefixes(firstPrefixes);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("adminUsers.audit.title")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t("adminUsers.audit.all")} selected={prefix === null} onPress={() => setPrefix(null)} soft />
        {prefixes.map((p) => (
          <Chip key={p} label={p.replace(/\.$/, "")} selected={prefix === p} onPress={() => setPrefix(p)} soft />
        ))}
      </ScrollView>
      {userId ? (
        <View style={styles.userFilter}>
          <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
            {t("adminUsers.audit.forUser", { name: params.name || userId })}
          </AppText>
          <Button
            variant="ghost"
            title={t("adminUsers.audit.clearUser")}
            onPress={() => router.setParams({ userId: "", name: "" })}
          />
        </View>
      ) : null}
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : isBlockingError(query) ? (
        <CenterMessage
          title={errorMessage(query.error, "adminUsers")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={[styles.list, entries.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => query.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={<CenterMessage title={t("adminUsers.audit.empty")} />}
          ListFooterComponent={
            <LoadMoreFooter
              hasMore={!!query.hasNextPage}
              loading={query.isFetchingNextPage}
              failed={query.isFetchNextPageError}
              onPress={() => void query.fetchNextPage()}
            />
          }
          renderItem={({ item }) => <AuditRow entry={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function AuditRow({ entry: e }: { entry: AdminAuditEntry }) {
  const { t } = useTranslation();
  const actor = e.actorLabel || e.actorUserId || t("adminUsers.audit.system");
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <AppText variant="mono" style={{ flex: 1 }} numberOfLines={1}>
          {e.action}
        </AppText>
        <AppText variant="caption">{formatDayTime(e.createdAt)}</AppText>
      </View>
      <AppText variant="caption" numberOfLines={1}>
        {t("adminUsers.audit.actor")}: {actor} ({e.actorRole})
      </AppText>
      {e.entityId ? (
        <AppText variant="caption" numberOfLines={1}>
          {t("adminUsers.audit.target")}: {e.entityType ?? ""} {e.entityId}
        </AppText>
      ) : null}
      {e.metadata ? (
        <AppText variant="caption" style={{ fontSize: 12 }} numberOfLines={3}>
          {e.metadata}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  chips: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.sm },
  userFilter: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.xl, gap: space.sm },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.sm },
  row: {
    gap: 2,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
