import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Truck } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card, CenterMessage, Divider, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { usePartnerSeals } from "@/lib/queries";
import type { SealDeliveryResponse, SealRequest, SealRequestResponse } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** `seals/request` ucunun mobil ust siniri (`MOBILE_MAX_COUNT`); fazlasi sunucuda sessizce kirpilir. */
const MAX_REQUEST = 100;

/**
 * Esnafin muhur stogu: talep ac, arizali muhur bildir, kargoyu teslim aldigini onayla.
 * Kurallar `SealService`te; burada yalnizca girdi bicimi denetlenir ve kod cevrilir.
 */
export default function PartnerSealsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = usePartnerSeals();
  const [count, setCount] = useState("10");
  const [serial, setSerial] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [faultyError, setFaultyError] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["partner"] });

  const requestSeals = useMutation({
    mutationFn: (n: number) =>
      api<SealRequestResponse>("/partner/seals/request", { method: "POST", body: { count: n } }),
    onSuccess: (res) => {
      setRequestError(null);
      setCount("10");
      refresh();
      Alert.alert(t("seals.requestedTitle"), t("seals.requestedBody", { count: res.count }));
    },
    onError: (e) => setRequestError(errorMessage(e, "seals")),
  });

  const reportFaulty = useMutation({
    mutationFn: (serialNumber: number) =>
      api<{ success: true }>("/partner/seals/report-faulty", { method: "POST", body: { serialNumber } }),
    onSuccess: () => {
      setFaultyError(null);
      setSerial("");
      refresh();
      Alert.alert(t("seals.faultyReportedTitle"), t("seals.faultyReportedBody"));
    },
    onError: (e) => setFaultyError(errorMessage(e, "seals")),
  });

  const confirmDelivery = useMutation({
    mutationFn: (requestId: string) =>
      api<SealDeliveryResponse>("/partner/seals/confirm-delivery", { method: "POST", body: { requestId } }),
    onSuccess: (res) => {
      refresh();
      Alert.alert(t("seals.deliveredTitle"), t("seals.deliveredBody", { count: res.assignedCount }));
    },
    onError: (e) => Alert.alert(t("seals.deliveryFailed"), errorMessage(e, "seals")),
  });

  const parsedCount = Number(count);
  const countValid = Number.isInteger(parsedCount) && parsedCount >= 1 && parsedCount <= MAX_REQUEST;
  const parsedSerial = Number(serial);
  const serialValid = serial !== "" && Number.isInteger(parsedSerial) && parsedSerial > 0;

  function askConfirmDelivery(r: SealRequest) {
    Alert.alert(t("seals.confirmTitle"), t("seals.confirmBody", { count: r.quantity }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("seals.confirmCta"), onPress: () => confirmDelivery.mutate(r.id) },
    ]);
  }

  function askReportFaulty() {
    Alert.alert(t("seals.faultyConfirmTitle"), t("seals.faultyConfirmBody", { n: parsedSerial }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("seals.faultyCta"), style: "destructive", onPress: () => reportFaulty.mutate(parsedSerial) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("seals.title")}</AppText>
        <View style={{ width: 44 }} />
      </View>

      {query.isLoading ? (
        <Loading />
      ) : query.isError || !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "seals")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
        >
          {query.data.assignedCount < query.data.sealReorderPoint ? (
            <Banner tone="warning" body={t("seals.lowStock", { count: query.data.assignedCount })} />
          ) : null}

          <View style={styles.stats}>
            <Stat value={query.data.assignedCount} label={t("seals.ready")} />
            <Stat value={query.data.inUseCount} label={t("seals.inUse")} />
            <Stat value={query.data.returnedCount} label={t("seals.returned")} />
          </View>

          <Card style={styles.card}>
            <AppText variant="heading" nativeID="seal-request-count">
              {t("seals.requestTitle")}
            </AppText>
            <AppText variant="caption">{t("seals.requestHint", { max: MAX_REQUEST })}</AppText>
            <TextInput
              accessibilityLabelledBy="seal-request-count"
              accessibilityLabel={t("seals.requestCount")}
              value={count}
              onChangeText={(v) => setCount(v.replace(/\D/g, "").slice(0, 3))}
              placeholder={t("seals.requestCount")}
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              style={styles.input}
            />
            {count !== "" && !countValid ? (
              <Banner tone="warning" body={t("seals.countRange", { max: MAX_REQUEST })} />
            ) : null}
            {requestError ? <Banner tone="danger" body={requestError} /> : null}
            <Button
              title={t("seals.requestCta")}
              loading={requestSeals.isPending}
              disabled={!countValid}
              onPress={() => requestSeals.mutate(parsedCount)}
            />
          </Card>

          <Card style={styles.card}>
            <AppText variant="heading" nativeID="seal-faulty-serial">
              {t("seals.faultyTitle")}
            </AppText>
            <AppText variant="caption">{t("seals.faultyHint")}</AppText>
            <TextInput
              accessibilityLabelledBy="seal-faulty-serial"
              accessibilityLabel={t("seals.serialNumber")}
              value={serial}
              onChangeText={(v) => setSerial(v.replace(/\D/g, "").slice(0, 10))}
              placeholder={t("seals.serialNumber")}
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              style={styles.input}
            />
            {faultyError ? <Banner tone="danger" body={faultyError} /> : null}
            <Button
              variant="danger"
              title={t("seals.faultyCta")}
              loading={reportFaulty.isPending}
              disabled={!serialValid}
              onPress={askReportFaulty}
            />
          </Card>

          <Card style={styles.card}>
            <AppText variant="heading">{t("seals.historyTitle")}</AppText>
            {query.data.requests.length === 0 ? (
              <AppText variant="caption">{t("seals.noRequests")}</AppText>
            ) : (
              query.data.requests.map((r, i) => (
                <View key={r.id} style={{ gap: space.sm }}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.requestRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="bodyMedium">
                        {t("seals.quantity", { count: r.quantity })}
                        {r.autoGenerated ? ` · ${t("seals.auto")}` : ""}
                      </AppText>
                      <AppText variant="caption">{formatDay(r.createdAt)}</AppText>
                    </View>
                    <RequestStatus status={r.status} />
                  </View>
                  {r.status === "SHIPPED" && r.trackingNumber ? (
                    <AppText variant="caption">{t("seals.tracking", { tracking: r.trackingNumber })}</AppText>
                  ) : null}
                  {r.serialFrom != null && r.serialTo != null && r.status !== "PENDING" ? (
                    <AppText variant="caption">{t("seals.serialRange", { from: r.serialFrom, to: r.serialTo })}</AppText>
                  ) : null}
                  {r.status === "SHIPPED" && r.adminNote ? <AppText variant="caption">{r.adminNote}</AppText> : null}
                  {r.status === "SHIPPED" ? (
                    <Button
                      title={t("seals.confirmCta")}
                      loading={confirmDelivery.isPending && confirmDelivery.variables === r.id}
                      disabled={confirmDelivery.isPending}
                      icon={<CheckCircle2 size={18} color={colors.white} />}
                      onPress={() => askConfirmDelivery(r)}
                    />
                  ) : null}
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card style={styles.stat}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText variant="caption" style={{ textAlign: "center" }}>
        {label}
      </AppText>
    </Card>
  );
}

function RequestStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === "PENDING") {
    return (
      <View style={styles.status}>
        <Clock size={16} color={colors.warning} />
        <AppText variant="label" style={{ color: colors.warning }}>
          {t("seals.statusPending")}
        </AppText>
      </View>
    );
  }
  if (status === "SHIPPED") {
    return (
      <View style={styles.status}>
        <Truck size={16} color={colors.brand} />
        <AppText variant="label" style={{ color: colors.brand }}>
          {t("seals.statusShipped")}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.status}>
      <CheckCircle2 size={16} color={colors.success} />
      <AppText variant="label" style={{ color: colors.success }}>
        {t("seals.statusDelivered")}
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
  content: { padding: space.xl, gap: space.lg },
  stats: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: space.lg },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  card: { gap: space.md },
  input: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  requestRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  status: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
