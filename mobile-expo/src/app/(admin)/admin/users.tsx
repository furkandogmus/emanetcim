import { useState } from "react";
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { SearchBox } from "@/components/SearchBox";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { keys, useAdminUsers } from "@/lib/queries";
import type { AdminUser } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/**
 * Kullanici arama ve yasaklama. Yasak sunucuda token surumunu artirir: kisinin acik
 * oturumlari aninda duser. Rol degisikligi ve silme webde kalir (iki admin onayi istiyor).
 */
export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { state, startImpersonation } = useAuth();
  const myId = state.status === "signedIn" ? state.user.id : null;
  const [q, setQ] = useState("");
  const query = useAdminUsers(q);

  const ban = useMutation({
    mutationFn: ({ id, isBanned }: { id: string; isBanned: boolean }) =>
      api(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { isBanned } }),
    // Basari penceresi yok: "Engelli" etiketi ve dugme metni degisiyor, bu yeterli geri bildirim.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...keys.admin, "users"] }),
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "admin")),
  });

  function confirmBan(u: AdminUser) {
    if (u.isBanned) return ban.mutate({ id: u.id, isBanned: false });
    Alert.alert(t("admin.banTitle", { name: u.name || u.email }), t("admin.banBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("admin.banConfirm"), style: "destructive", onPress: () => ban.mutate({ id: u.id, isBanned: true }) },
    ]);
  }

  // Basarida rol degisir; Stack.Protected hedefin paneline gecirir, bu ekran kendiliginden kapanir.
  const viewAs = useMutation({
    mutationFn: (id: string) => startImpersonation(id),
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "admin")),
  });

  function confirmViewAs(u: AdminUser) {
    Alert.alert(t("admin.impersonateTitle", { name: u.name || u.email || u.phone }), t("admin.impersonateBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("admin.impersonateConfirm"), onPress: () => viewAs.mutate(u.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("admin.users")} />
      <View style={styles.search}>
        <SearchBox placeholder={t("admin.userSearchPlaceholder")} onSearch={setQ} />
      </View>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, !query.data?.length && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<CenterMessage title={t("admin.noUsers")} />}
          renderItem={({ item: u }) => {
            const self = u.id === myId;
            return (
              <View style={[styles.card, u.isBanned && styles.banned]}>
                <View style={styles.top}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyMedium" numberOfLines={1}>
                      {u.name || u.email || u.phone}
                    </AppText>
                    {u.email && u.name ? (
                      <AppText variant="caption" numberOfLines={1}>
                        {u.email}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" style={{ fontSize: 13 }}>
                      {[
                        t(`admin.role.${u.role}`),
                        t("admin.userBookings", { count: u.bookingCount }),
                        u.shopCount > 0 ? t("admin.userShops", { count: u.shopCount }) : null,
                        formatDay(u.createdAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  </View>
                </View>
                <View style={styles.bottom}>
                  <View style={styles.tags}>
                    {u.phone ? (
                      <IconButton label={t("admin.call")} onPress={() => open(`tel:${u.phone}`)}>
                        <Phone size={18} color={colors.ink} />
                      </IconButton>
                    ) : null}
                    {u.email ? (
                      <IconButton label={t("admin.email")} onPress={() => open(`mailto:${u.email}`)}>
                        <Mail size={18} color={colors.ink} />
                      </IconButton>
                    ) : null}
                    {u.isBanned ? <Tag label={t("admin.bannedTag")} warn /> : null}
                    {u.isTest ? <Tag label={t("admin.testRecord")} /> : null}
                  </View>
                  {!self ? (
                    <Button
                      variant="secondary"
                      title={u.isBanned ? t("admin.unban") : t("admin.ban")}
                      loading={ban.isPending && ban.variables?.id === u.id}
                      onPress={() => confirmBan(u)}
                    />
                  ) : null}
                </View>
                {u.role !== "ADMIN" && !u.isBanned ? (
                  <Button
                    variant="secondary"
                    title={t("admin.impersonate")}
                    loading={viewAs.isPending && viewAs.variables === u.id}
                    disabled={viewAs.isPending}
                    onPress={() => confirmViewAs(u)}
                  />
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Tag({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <View style={[styles.tag, warn && { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}>
      <AppText variant="caption" style={[{ fontSize: 12 }, warn && { color: colors.accent }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  search: { paddingHorizontal: space.xl, paddingBottom: space.md },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  banned: { borderStyle: "dashed", backgroundColor: colors.surfaceMuted },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  tags: { flexDirection: "row", alignItems: "center", gap: space.sm, flex: 1 },
  tag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
