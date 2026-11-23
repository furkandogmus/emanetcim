import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Sheet } from "@/components/Sheet";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { AppText, Banner, Button, Card, CenterMessage, Loading } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { keys, useAdminRoleApprovals } from "@/lib/queries";
import { isBlockingError } from "@/lib/query-view";
import type { AdminRoleChangeRequest } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

type Decision = { request: AdminRoleChangeRequest; action: "approve" | "reject" };

/** Istek sunucuda zaten kalkmis: liste tazelenmeli, hata gosterip eski satiri birakmak yaniltir. */
const GONE = new Set(["stale", "not_found", "cannot_demote_sole_admin"]);

/**
 * Rol onaylari: web `/admin/role-approvals` ile ayni liste. Onay/red sayfa ici onay
 * panelinden gecer; kural (kendi istegi, son admin) sunucuda `AdminUserService`.
 */
export default function AdminRoleApprovalsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useAdminRoleApprovals();
  const [decision, setDecision] = useState<Decision | null>(null);

  const refresh = () => {
    for (const k of ["role-approvals", "users", "overview"]) {
      void queryClient.invalidateQueries({ queryKey: [...keys.admin, k] });
    }
  };

  const decide = useMutation({
    mutationFn: ({ request, action }: Decision) =>
      api<{ ok: true }>(`/admin/role-approvals/${request.id}/${action}`, { method: "POST" }),
    onSuccess: (_res, { request, action }) => {
      setDecision(null);
      refresh();
      notify(
        action === "approve"
          ? t("roleApprovals.approved")
          : request.isOwnRequest
            ? t("roleApprovals.withdrawn")
            : t("roleApprovals.rejected"),
      );
    },
    onError: (err) => {
      if (err instanceof ApiError && GONE.has(err.code)) {
        setDecision(null);
        refresh();
        notify(errorMessage(err, "roleApprovals"));
      }
    },
  });

  const roleName = (r: string) => t(`admin.role.${r}`);
  const nameOf = (u: { name: string | null; email: string | null }) => u.name || u.email || "—";

  function open(request: AdminRoleChangeRequest, action: Decision["action"]) {
    decide.reset();
    setDecision({ request, action });
  }
  function close() {
    if (decide.isPending) return;
    setDecision(null);
  }

  const d = decision;
  const vars = d
    ? { name: nameOf(d.request.target), from: roleName(d.request.previousRole), to: roleName(d.request.requestedRole) }
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("roleApprovals.title")} />
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
          data={query.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, !query.data?.length && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListHeaderComponent={<AppText variant="caption">{t("roleApprovals.intro")}</AppText>}
          ListEmptyComponent={<CenterMessage title={t("roleApprovals.empty")} />}
          renderItem={({ item }) => (
            <Card style={{ gap: space.md }}>
              <View style={{ gap: 2 }} testID={`role-request-${item.id}`}>
                <AppText variant="heading">{nameOf(item.target)}</AppText>
                <AppText variant="bodyMedium">
                  {t("roleApprovals.change", { from: roleName(item.previousRole), to: roleName(item.requestedRole) })}
                </AppText>
                <AppText variant="caption">
                  {t("roleApprovals.requestedBy", { name: nameOf(item.requestedBy), date: formatDay(item.createdAt) })}
                </AppText>
              </View>
              {item.isOwnRequest ? <Banner tone="brand" body={t("roleApprovals.ownRequest")} /> : null}
              <View style={styles.actions}>
                <Button
                  style={{ flex: 1 }}
                  title={t("roleApprovals.approve")}
                  disabled={item.isOwnRequest}
                  onPress={() => open(item, "approve")}
                />
                <Button
                  style={{ flex: 1 }}
                  variant="secondary"
                  // Kendi istegini "reddetmek" yerine geri cekiyorsun; sunucuda ayni islem (iptal).
                  title={item.isOwnRequest ? t("roleApprovals.withdraw") : t("roleApprovals.reject")}
                  onPress={() => open(item, "reject")}
                />
              </View>
            </Card>
          )}
        />
      )}

      <Sheet visible={!!d} onClose={close}>
        {d && vars ? (
          <View style={{ gap: space.lg }} testID="role-decision-confirm">
            <AppText variant="heading" accessibilityRole="header">
              {d.action === "approve"
                ? t("roleApprovals.approveTitle")
                : d.request.isOwnRequest
                  ? t("roleApprovals.withdrawTitle")
                  : t("roleApprovals.rejectTitle")}
            </AppText>
            <AppText variant="body">
              {d.action === "approve" ? t("roleApprovals.approveBody", vars) : t("roleApprovals.rejectBody", vars)}
            </AppText>
            {decide.isError ? <Banner tone="danger" body={errorMessage(decide.error, "roleApprovals")} /> : null}
            <Button
              variant={d.action === "approve" ? "primary" : "danger"}
              title={
                d.action === "approve"
                  ? t("roleApprovals.approve")
                  : d.request.isOwnRequest
                    ? t("roleApprovals.withdraw")
                    : t("roleApprovals.reject")
              }
              loading={decide.isPending}
              onPress={() => decide.mutate(d)}
            />
            <Button variant="ghost" title={t("common.cancel")} disabled={decide.isPending} onPress={close} />
          </View>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.md },
  actions: { flexDirection: "row", gap: space.md },
});
