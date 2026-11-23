import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { LoadMoreFooter } from "@/components/LoadMoreFooter";
import { ReasonSheet } from "@/components/ReasonSheet";
import { Segmented } from "@/components/Segmented";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { AppText, Banner, Button, CenterMessage, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { flattenPages } from "@/lib/paging";
import { useAdminReviews, useModerateReview } from "@/lib/queries";
import { isBlockingError } from "@/lib/query-view";
import { canEditAdminContent, canSubmitModeration, MIN_MODERATION_REASON } from "@/lib/review-moderation";
import type { AdminReview, AdminReviewFilter, ReviewModerationAction } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";

const DONE_KEY = { hide: "adminShop.hiddenDone", unhide: "adminShop.unhiddenDone", delete: "adminShop.deletedDone" } as const;

/**
 * Yorum moderasyonu. `?shop=<id>&name=` ile tek dukkanin yorumlari, parametresiz
 * platformun son yorumlari. Gizleme ve silme gerekce paneliyle, geri alma onayla.
 * Ortalama sunucuda yeniden hesaplanir (`ReviewService.moderate`).
 */
export default function AdminReviewsScreen() {
  const { t } = useTranslation();
  const { shop, name } = useLocalSearchParams<{ shop?: string; name?: string }>();
  const { impersonating } = useAuth();
  const canEdit = canEditAdminContent(impersonating);
  // Bildirilenler kuyrugu once (App Review 1.2); dukkan ekranindan gelince tum yorumlar.
  const [filter, setFilter] = useState<AdminReviewFilter>(shop ? "all" : "reported");
  const query = useAdminReviews(filter, shop ?? null);
  const items = flattenPages(query.data, (p) => p.items);
  const total = query.data?.pages[0]?.total;
  const moderate = useModerateReview();

  const [pending, setPending] = useState<{ review: AdminReview; action: "hide" | "delete" } | null>(null);
  const [reason, setReason] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);

  function run(review: AdminReview, action: ReviewModerationAction, why?: string) {
    moderate.mutate(
      { id: review.id, action, reason: why?.trim() },
      {
        onSuccess: () => {
          setPending(null);
          notify(t(DONE_KEY[action]));
        },
        onError: (e) => {
          if (pending) setSheetError(errorMessage(e, "adminShop"));
          else notify(t("adminShop.actionFailed"), errorMessage(e, "adminShop"));
        },
      },
    );
  }

  function ask(review: AdminReview, action: ReviewModerationAction) {
    if (action === "unhide") {
      Alert.alert(t("adminShop.unhideTitle"), t("adminShop.unhideBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("adminShop.unhideConfirm"), onPress: () => run(review, "unhide") },
      ]);
      return;
    }
    setReason("");
    setSheetError(null);
    setPending({ review, action });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t(shop ? "adminShop.reviews" : "adminShop.recentReviews")} subtitle={name || undefined} />
      <View style={styles.filters}>
        <Segmented
          options={[
            { value: "reported", label: t("adminShop.filterReported") },
            { value: "all", label: t("adminShop.filterAll") },
            { value: "low", label: t("adminShop.filterLow") },
            { value: "hidden", label: t("adminShop.filterHidden") },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {total !== undefined ? <AppText variant="caption">{t("adminShop.total", { count: total })}</AppText> : null}
        {!canEdit ? <Banner tone="warning" body={t("adminShop.readOnly")} /> : null}
      </View>
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : isBlockingError(query) ? (
        <CenterMessage
          title={errorMessage(query.error, "adminShop")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, items.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => query.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={<CenterMessage title={t("adminShop.noReviews")} />}
          ListFooterComponent={
            <LoadMoreFooter
              hasMore={!!query.hasNextPage}
              loading={query.isFetchingNextPage}
              failed={query.isFetchNextPageError}
              onPress={() => void query.fetchNextPage()}
            />
          }
          renderItem={({ item }) => (
            <ReviewRow
              review={item}
              showShop={!shop}
              canEdit={canEdit}
              busy={moderate.isPending && moderate.variables?.id === item.id}
              onAction={(action) => ask(item, action)}
            />
          )}
        />
      )}

      <ReasonSheet
        visible={pending !== null}
        onClose={() => setPending(null)}
        title={t(pending?.action === "delete" ? "adminShop.deleteTitle" : "adminShop.hideTitle")}
        body={t(pending?.action === "delete" ? "adminShop.deleteBody" : "adminShop.hideBody")}
        note={reason}
        onNoteChange={(v) => {
          setReason(v);
          setSheetError(null);
        }}
        noteLabel={t("adminShop.reasonLabel")}
        notePlaceholder={t("adminShop.reasonPlaceholder")}
        noteHint={t("adminShop.reasonHint", { min: MIN_MODERATION_REASON })}
        confirmLabel={t(pending?.action === "delete" ? "adminShop.deleteConfirm" : "adminShop.hideConfirm")}
        canSubmit={!!pending && canEdit && canSubmitModeration(pending.action, reason)}
        loading={moderate.isPending}
        error={sheetError}
        onConfirm={() => pending && run(pending.review, pending.action, reason)}
      />
    </SafeAreaView>
  );
}

function ReviewRow({
  review: r,
  showShop,
  canEdit,
  busy,
  onAction,
}: {
  review: AdminReview;
  showShop: boolean;
  canEdit: boolean;
  busy: boolean;
  onAction: (action: ReviewModerationAction) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, r.hidden && styles.hiddenCard]}>
      <View style={styles.meta}>
        <Star size={14} color={colors.brand} fill={colors.brand} />
        <AppText variant="bodyMedium">{r.rating}</AppText>
        <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
          {r.guestName || t("partner.guest")} · {formatDay(r.createdAt)}
        </AppText>
        {r.openReportCount > 0 ? (
          <View style={[styles.tag, { backgroundColor: colors.dangerSoft }]}>
            <AppText variant="label" style={{ fontSize: 11 }}>
              {t("adminShop.reportCount", { count: r.openReportCount })}
            </AppText>
          </View>
        ) : null}
        {r.hidden ? (
          <View style={styles.tag}>
            <AppText variant="label" style={{ fontSize: 11 }}>
              {t(r.autoHidden ? "adminShop.autoHiddenTag" : "adminShop.hiddenTag")}
            </AppText>
          </View>
        ) : null}
      </View>
      {showShop ? (
        <Pressable accessibilityRole="link" onPress={() => router.push(`/admin/shop/${r.shop.id}`)}>
          <AppText variant="caption" style={{ color: colors.accent }}>
            {r.shop.name}
          </AppText>
        </Pressable>
      ) : null}
      <AppText variant="body" style={!r.comment ? { color: colors.inkMuted } : undefined}>
        {r.comment || t("adminShop.noComment")}
      </AppText>
      {r.hidden && r.hiddenReason ? (
        <AppText variant="caption">{t("adminShop.hiddenBecause", { reason: r.hiddenReason })}</AppText>
      ) : null}
      {r.reports.map((rep, i) => (
        <AppText key={i} variant="caption" style={{ color: colors.danger }}>
          {t(`review.reportReason.${rep.reason}`)}
          {rep.note ? `: ${rep.note}` : ""}
        </AppText>
      ))}
      {canEdit ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            title={t(r.hidden ? "adminShop.unhide" : "adminShop.hide")}
            loading={busy}
            disabled={busy}
            onPress={() => onAction(r.hidden ? "unhide" : "hide")}
            style={{ flex: 1 }}
          />
          <Button
            variant="ghost"
            textColor={colors.danger}
            title={t("adminShop.delete")}
            disabled={busy}
            onPress={() => onAction("delete")}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  filters: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.sm },
  list: { padding: space.xl, paddingTop: 0, gap: space.md },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hiddenCard: { backgroundColor: colors.surfaceMuted },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  tag: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.border },
  actions: { flexDirection: "row", gap: space.sm },
});
