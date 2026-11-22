import { useState } from "react";
import { KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_BODY_MAX,
  BROADCAST_REASON_MIN,
  BROADCAST_TITLE_MAX,
  EMPTY_BROADCAST_FORM,
  broadcastErrorMessage,
  canSendBroadcast,
  charCount,
  contentBody,
  isContentValid,
  type BroadcastForm,
} from "@/lib/broadcast";
import { formatDayTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { adminBroadcastsKey, useAdminBroadcasts, useBroadcastPreview } from "@/lib/queries";
import type { AdminBroadcast, BroadcastAudience } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * Yonetici duyurusu: yalniz operasyonel (bakim, kesinti). Pazarlama mesaji ticari ileti
 * onayi gerektirdigi icin bilerek yok. Gonderim sunucuda arka planda surer; ekran sonucu
 * gecmis listesinden izler.
 */
export default function AdminBroadcastScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<BroadcastForm>(EMPTY_BROADCAST_FORM);
  const [showEn, setShowEn] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ devices: number } | null>(null);
  const preview = useBroadcastPreview(form.audience);
  const history = useAdminBroadcasts();
  const set = (patch: Partial<BroadcastForm>) => setForm((f) => ({ ...f, ...patch }));

  const test = useMutation({
    mutationFn: () =>
      api<{ success: true; devices: number }>("/admin/broadcasts/test", { method: "POST", body: contentBody(form) }),
    onSuccess: (r) =>
      notify(
        t("broadcast.testSentTitle"),
        r.devices > 0 ? t("broadcast.testSentBody", { count: r.devices }) : t("broadcast.testNoDevices"),
      ),
    onError: (e) => notify(t("broadcast.failedTitle"), broadcastErrorMessage(e)),
  });

  const send = useMutation({
    mutationFn: () =>
      api<{ id: string; devices: number }>("/admin/broadcasts", {
        method: "POST",
        body: { audience: form.audience, ...contentBody(form), reason: form.reason.trim() },
      }),
    onSuccess: (r) => {
      setConfirming(false);
      setSent({ devices: r.devices });
      setSendError(null);
      setForm(EMPTY_BROADCAST_FORM);
      setShowEn(false);
      void qc.invalidateQueries({ queryKey: adminBroadcastsKey });
    },
    onError: (e) => {
      setConfirming(false);
      setSendError(broadcastErrorMessage(e));
    },
  });

  const audienceLabel = (a: BroadcastAudience) => t(`broadcast.audience.${a}`);
  // Onay paneli bir cihaz sayisi tekrarlar: sayi yuklenirken ya da hatadayken 0 / bayat sayi gostermesin.
  const previewFresh = preview.isSuccess && !preview.isFetching;
  const ready = canSendBroadcast(form) && previewFresh;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("broadcast.title")} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={history.isRefetching}
              onRefresh={() => {
                void history.refetch();
                if (form.audience) void preview.refetch();
              }}
              tintColor={colors.accent}
            />
          }
        >
          {sent ? (
            <View style={{ gap: space.md }}>
              <Banner tone="success" title={t("broadcast.sentTitle")} body={t("broadcast.sentBody", { count: sent.devices })} />
              <Button
                variant="secondary"
                title={t("broadcast.newBroadcast")}
                onPress={() => {
                  setSent(null);
                  setSendError(null);
                }}
              />
            </View>
          ) : (
            <View style={{ gap: space.lg }}>
              <Banner body={t("broadcast.operationalOnly")} />

              <View style={{ gap: space.xs }}>
                <AppText variant="label">{t("broadcast.audienceLabel")}</AppText>
                <Segmented
                  options={BROADCAST_AUDIENCES.map((a) => ({ value: a, label: audienceLabel(a) }))}
                  value={form.audience}
                  onChange={(audience) => {
                    setSendError(null);
                    set({ audience });
                  }}
                />
                <AppText variant="caption" testID="broadcast-preview">
                  {!form.audience
                    ? t("broadcast.pickAudience")
                    : preview.data
                      ? t("broadcast.previewLine", { users: preview.data.users, devices: preview.data.devices })
                      : preview.isError
                        ? t("broadcast.previewFailed")
                        : t("broadcast.previewLoading")}
                </AppText>
              </View>

              <Field
                label={t("broadcast.titleTr")}
                value={form.titleTr}
                onChangeText={(titleTr) => set({ titleTr })}
                maxLength={BROADCAST_TITLE_MAX}
                hint={`${charCount(form.titleTr)}/${BROADCAST_TITLE_MAX}`}
              />
              <Field
                label={t("broadcast.bodyTr")}
                value={form.bodyTr}
                onChangeText={(bodyTr) => set({ bodyTr })}
                maxLength={BROADCAST_BODY_MAX}
                multiline
                hint={`${charCount(form.bodyTr)}/${BROADCAST_BODY_MAX}`}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showEn }}
                onPress={() => setShowEn((v) => !v)}
                style={styles.toggle}
              >
                <AppText variant="bodyMedium" style={{ flex: 1 }}>
                  {t("broadcast.englishToggle")}
                </AppText>
                {showEn ? <ChevronUp size={18} color={colors.inkMuted} /> : <ChevronDown size={18} color={colors.inkMuted} />}
              </Pressable>
              {showEn ? (
                <View style={{ gap: space.lg }}>
                  <AppText variant="caption">{t("broadcast.englishHint")}</AppText>
                  <Field
                    label={t("broadcast.titleEn")}
                    value={form.titleEn}
                    onChangeText={(titleEn) => set({ titleEn })}
                    maxLength={BROADCAST_TITLE_MAX}
                    hint={`${charCount(form.titleEn)}/${BROADCAST_TITLE_MAX}`}
                  />
                  <Field
                    label={t("broadcast.bodyEn")}
                    value={form.bodyEn}
                    onChangeText={(bodyEn) => set({ bodyEn })}
                    maxLength={BROADCAST_BODY_MAX}
                    multiline
                    hint={`${charCount(form.bodyEn)}/${BROADCAST_BODY_MAX}`}
                  />
                </View>
              ) : null}

              <Button
                variant="secondary"
                title={t("broadcast.sendTest")}
                disabled={!isContentValid(form)}
                loading={test.isPending}
                onPress={() => test.mutate()}
              />

              <Field
                label={t("broadcast.reason")}
                value={form.reason}
                onChangeText={(reason) => set({ reason })}
                hint={t("broadcast.reasonHint", { min: BROADCAST_REASON_MIN })}
                maxLength={500}
              />

              {sendError ? <Banner tone="danger" body={sendError} /> : null}

              <Button
                title={t("broadcast.send")}
                disabled={!ready}
                onPress={() => {
                  setSendError(null);
                  setConfirming(true);
                  // Onizleme ekran acildigindan beri eskimis olabilir: onayda taze sayi gosterilir.
                  void preview.refetch();
                }}
              />
            </View>
          )}

          <View style={{ gap: space.sm }}>
            <AppText variant="label">{t("broadcast.historyTitle")}</AppText>
            {history.data?.length ? (
              history.data.map((b) => <HistoryRow key={b.id} item={b} audience={audienceLabel(b.audience)} />)
            ) : (
              <AppText variant="caption">
                {history.isLoading ? t("broadcast.previewLoading") : history.isError ? broadcastErrorMessage(history.error) : t("broadcast.historyEmpty")}
              </AppText>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={confirming} onClose={() => setConfirming(false)}>
        <View style={{ gap: space.lg }} testID="broadcast-confirm">
          <AppText variant="heading">{t("broadcast.confirmTitle")}</AppText>
          <AppText variant="body">
            {previewFresh && preview.data
              ? t("broadcast.confirmBody", {
                  audience: form.audience ? audienceLabel(form.audience) : "",
                  devices: preview.data.devices,
                })
              : t("broadcast.previewLoading")}
          </AppText>
          <Card style={{ gap: 2 }}>
            <AppText variant="bodyMedium">{form.titleTr.trim()}</AppText>
            <AppText variant="caption">{form.bodyTr.trim()}</AppText>
          </Card>
          <Button
            title={t("broadcast.confirmSend")}
            disabled={!previewFresh}
            loading={send.isPending}
            onPress={() => send.mutate()}
          />
          <Button variant="ghost" title={t("common.cancel")} onPress={() => setConfirming(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function HistoryRow({ item, audience }: { item: AdminBroadcast; audience: string }) {
  const { t } = useTranslation();
  const active = item.status === "QUEUED" || item.status === "SENDING";
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <AppText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
          {item.titleTr}
        </AppText>
        <View style={[styles.status, item.status === "FAILED" && { backgroundColor: colors.dangerSoft }]}>
          <AppText variant="label" style={active ? { color: colors.accent } : undefined}>
            {t(`broadcast.status.${item.status}`)}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" numberOfLines={2}>
        {item.bodyTr}
      </AppText>
      <AppText variant="caption" style={styles.meta}>
        {t("broadcast.counts", { sent: item.sent, failed: item.failed, targeted: item.targetedDevices })}
      </AppText>
      <AppText variant="caption" style={styles.meta}>
        {[audience, formatDayTime(item.createdAt), item.createdByName].filter(Boolean).join(" · ")}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.xl },
  toggle: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  row: {
    gap: 4,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  status: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  meta: { fontSize: 13, fontFamily: fonts.body, fontVariant: ["tabular-nums"] },
});
