import { useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ReasonSheet } from "@/components/ReasonSheet";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { AppText, Banner, Button, Card, CenterMessage, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useAdminDeletionRequests, useResolveDeletionRequest } from "@/lib/queries";
import { isBlockingError } from "@/lib/query-view";
import type { AdminDeletionRequest } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

/** Sunucudaki gerekce alt siniri (`ADMIN_ERASURE_REASON_MIN`). */
const MIN_REASON = 5;

/**
 * Esnaf/yonetici hesap silme talepleri: web `/admin/account-deletions` ile ayni liste.
 * Tamamlama aktif rezervasyon ve bekleyen hakedis kalmayinca acilir; kural sunucuda
 * (`AccountPrivacyService.completeDeletionRequest`).
 */
export default function AdminAccountDeletionsScreen() {
  const { t } = useTranslation();
  const { state, impersonating } = useAuth();
  const myId = state.status === "signedIn" ? state.user.id : null;
  const query = useAdminDeletionRequests();
  const resolve = useResolveDeletionRequest();
  const [cancelling, setCancelling] = useState<AdminDeletionRequest | null>(null);
  const [reason, setReason] = useState("");

  function complete(item: AdminDeletionRequest) {
    Alert.alert(t("accountDeletions.completeTitle"), t("accountDeletions.completeBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("accountDeletions.complete"),
        style: "destructive",
        onPress: () =>
          resolve.mutate(
            { id: item.id, action: "complete" },
            {
              onSuccess: () => notify(t("accountDeletions.completed")),
              onError: (e) => notify(t("accountDeletions.failed"), errorMessage(e, "accountDeletions")),
            },
          ),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("accountDeletions.title")} />
      <StaleQueryBanner query={query} />
      {impersonating ? <Banner tone="warning" body={t("adminShop.readOnly")} /> : null}
      {query.isLoading ? (
        <Loading />
      ) : isBlockingError(query) ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, !query.data?.length && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListHeaderComponent={<AppText variant="caption">{t("accountDeletions.intro")}</AppText>}
          ListEmptyComponent={<CenterMessage title={t("accountDeletions.empty")} />}
          renderItem={({ item }) => {
            const blocked = item.activeBookings > 0 || item.pendingPayouts > 0;
            const busy = resolve.isPending && resolve.variables?.id === item.id;
            const pending = item.status === "PENDING";
            return (
              <Card style={{ gap: space.sm }}>
                <AppText variant="heading">{item.user.name || item.user.email || "—"}</AppText>
                {item.user.email ? <AppText variant="caption">{item.user.email}</AppText> : null}
                <AppText variant="bodyMedium">
                  {t(`admin.role.${item.role}`)} · {t(`accountDeletions.status.${item.status}`)}
                </AppText>
                <AppText variant="caption">
                  {t("accountDeletions.dates", { requested: formatDay(item.requestedAt), due: formatDay(item.dueAt) })}
                </AppText>
                {pending && blocked ? (
                  <Banner
                    tone="warning"
                    body={t("accountDeletions.blockers", { bookings: item.activeBookings, payouts: item.pendingPayouts })}
                  />
                ) : null}
                {pending && !impersonating ? (
                  <View style={styles.actions}>
                    <Button
                      variant="danger"
                      title={t("accountDeletions.complete")}
                      loading={busy && resolve.variables?.action === "complete"}
                      disabled={busy || blocked || item.user.id === myId}
                      onPress={() => complete(item)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="secondary"
                      title={t("accountDeletions.cancel")}
                      disabled={busy}
                      onPress={() => {
                        setReason("");
                        resolve.reset();
                        setCancelling(item);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : null}
              </Card>
            );
          }}
        />
      )}
      <ReasonSheet
        visible={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={t("accountDeletions.cancelTitle")}
        body={
          cancelling && cancelling.reopenShops.length > 0
            ? t("accountDeletions.cancelBodyShops", { shops: cancelling.reopenShops.map((s) => s.name).join(", ") })
            : t("accountDeletions.cancelBodyNoShops")
        }
        note={reason}
        onNoteChange={setReason}
        noteLabel={t("adminShop.reasonLabel")}
        notePlaceholder={t("adminShop.reasonPlaceholder")}
        noteHint={t("adminShop.reasonHint", { min: MIN_REASON })}
        confirmLabel={t("accountDeletions.cancel")}
        canSubmit={reason.trim().length >= MIN_REASON}
        loading={resolve.isPending}
        error={resolve.isError ? errorMessage(resolve.error, "accountDeletions") : null}
        onConfirm={() =>
          cancelling &&
          resolve.mutate(
            { id: cancelling.id, action: "cancel", reason: reason.trim() },
            {
              onSuccess: () => {
                setCancelling(null);
                notify(t("accountDeletions.cancelled"));
              },
            },
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.md },
  actions: { flexDirection: "row", gap: space.md },
});
