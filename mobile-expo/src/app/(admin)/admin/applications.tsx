import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPinOff, Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay, formatMoney } from "@/lib/format";
import { keys, useAdminApplications } from "@/lib/queries";
import type { AdminApplication } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, space } from "@/theme/tokens";

export default function AdminApplicationsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useAdminApplications();

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api(`/admin/applications/${id}/${action}`, { method: "POST" }),
    onSuccess: (_res, { action }) => {
      void queryClient.invalidateQueries({ queryKey: keys.admin });
      notify(action === "approve" ? t("admin.approvedTitle") : t("admin.rejectedTitle"));
    },
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "admin")),
  });

  function confirmReject(app: AdminApplication) {
    // Red dukkani SILER (ShopService.rejectShop); geri donusu yok.
    Alert.alert(t("admin.rejectTitle", { name: app.name }), t("admin.rejectBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.rejectConfirm"),
        style: "destructive",
        onPress: () => decide.mutate({ id: app.id, action: "reject" }),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("admin.applications")}</AppText>
        <View style={{ width: 44 }} />
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
          keyExtractor={(a) => a.id}
          contentContainerStyle={[styles.list, !query.data?.length && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<CenterMessage title={t("admin.noApplications")} />}
          renderItem={({ item }) => {
            const busy = decide.isPending && decide.variables?.id === item.id;
            const place = [item.address, item.district, item.city].filter(Boolean).join(", ");
            return (
              <Card style={{ gap: space.sm }}>
                <AppText variant="heading">{item.name}</AppText>
                {place ? <AppText variant="caption">{place}</AppText> : null}
                <AppText variant="caption">
                  {t("admin.applicationMeta", {
                    price: formatMoney(item.pricePerDay),
                    capacity: item.capacity,
                    date: formatDay(item.createdAt),
                  })}
                </AppText>
                <AppText variant="bodyMedium">
                  {item.owner.name || t("admin.unnamed")}
                  {item.owner.email ? ` · ${item.owner.email}` : ""}
                </AppText>
                {!item.hasCoordinates ? (
                  <Banner tone="warning" body={t("admin.errors.missing_coordinates")} />
                ) : null}
                <View style={styles.actions}>
                  {item.owner.phone ? (
                    <IconButton
                      label={t("admin.call")}
                      onPress={() => void Linking.openURL(`tel:${item.owner.phone}`).catch(() => undefined)}
                    >
                      <Phone size={18} color={colors.ink} />
                    </IconButton>
                  ) : null}
                  <Button
                    variant="danger"
                    title={t("admin.reject")}
                    style={{ flex: 1 }}
                    disabled={busy}
                    onPress={() => confirmReject(item)}
                  />
                  <Button
                    title={t("admin.approve")}
                    style={{ flex: 1 }}
                    loading={busy && decide.variables?.action === "approve"}
                    disabled={busy || !item.hasCoordinates}
                    icon={!item.hasCoordinates ? <MapPinOff size={16} color={colors.white} /> : undefined}
                    onPress={() => decide.mutate({ id: item.id, action: "approve" })}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm },
});
