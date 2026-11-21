import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { MapSnippet } from "@/components/Illustrations";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { telUrl } from "@/lib/phone";
import { formatDay, formatMoney, initial } from "@/lib/format";
import { keys, useAdminApplications } from "@/lib/queries";
import type { AdminApplication } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { isBlockingError } from "@/lib/query-view";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";

export default function AdminApplicationsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useAdminApplications();

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api<{ success: boolean; partnerNotified?: boolean }>(`/admin/applications/${id}/${action}`, { method: "POST" }),
    onSuccess: (res, { action }) => {
      // Yalnizca etkilenenler: basvuru listesi, ozet sayaci ve dukkan listesi.
      for (const k of ["applications", "overview", "shops"]) {
        void queryClient.invalidateQueries({ queryKey: [...keys.admin, k] });
      }
      notify(
        action === "reject"
          ? t("admin.rejectedTitle")
          : res?.partnerNotified === false
            ? t("admin.approvedNotNotified")
            : t("admin.approvedTitle"),
      );
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
      <StackHeader title={t("admin.applications")} />

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
          keyExtractor={(a) => a.id}
          contentContainerStyle={[styles.list, !query.data?.length && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<CenterMessage art={<MapSnippet width={112} />} title={t("admin.noApplications")} />}
          renderItem={({ item }) => {
            const busy = decide.isPending && decide.variables?.id === item.id;
            const place = [item.address, item.district, item.city].filter(Boolean).join(", ");
            return (
              <Card style={{ gap: space.lg }}>
                <View style={{ gap: 2 }}>
                  <AppText variant="heading">{item.name}</AppText>
                  {place ? <AppText variant="caption">{place}</AppText> : null}
                </View>

                {/* Karar icin gereken uc bilgi yan yana; tek satir gri metin taranmiyordu. */}
                <View style={styles.facts}>
                  <Fact label={t("admin.factPrice")} value={formatMoney(item.pricePerDay)} />
                  <Fact label={t("admin.factCapacity")} value={t("common.bag", { count: item.capacity })} />
                  <Fact label={t("admin.factDate")} value={formatDay(item.createdAt)} />
                </View>

                <View style={styles.owner}>
                  <View style={styles.avatar}>
                    <AppText style={styles.avatarText}>
                      {initial(item.owner.name || item.owner.email || "?")}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium" numberOfLines={1}>
                      {item.owner.name || t("admin.unnamed")}
                    </AppText>
                    {item.owner.email ? (
                      <AppText variant="caption" numberOfLines={1}>
                        {item.owner.email}
                      </AppText>
                    ) : null}
                  </View>
                  {item.owner.phone ? (
                    <IconButton
                      label={t("admin.call")}
                      onPress={() => void Linking.openURL(telUrl(item.owner.phone ?? "", item.owner.whatsapp)).catch(() => undefined)}
                    >
                      <Phone size={18} color={colors.ink} />
                    </IconButton>
                  ) : null}
                </View>

                {!item.hasCoordinates ? (
                  <View style={{ gap: space.sm }}>
                    <Banner tone="warning" body={t("admin.errors.missing_coordinates")} />
                    <Button
                      variant="secondary"
                      title={t("admin.fixLocation")}
                      onPress={() => router.push(`/admin/shop/${item.id}`)}
                    />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    variant="secondary"
                    textColor={colors.danger}
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" style={{ fontSize: 13 }}>
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={{ fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        {value}
      </AppText>
    </View>
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
  facts: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  owner: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 15, color: colors.accent },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md },
});
