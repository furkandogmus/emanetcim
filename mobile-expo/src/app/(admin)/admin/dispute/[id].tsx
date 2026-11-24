import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { Field } from "@/components/Field";
import { AppText, Banner, Button, Card, Chip } from "@/components/ui";
import { BagPhotos } from "@/components/BagPhotos";
import { api } from "@/lib/api";
import { DISPUTE_NOTE_MAX, DISPUTE_STATUSES, adminOpsErrorMessage, canMutateAdminOps } from "@/lib/admin-ops";
import { formatMoney, formatStayRange } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { notify } from "@/lib/notify";
import { adminOpsKeys, keys, useAdminDispute } from "@/lib/queries";
import type { AdminDispute, AdminDisputeStatus } from "@/lib/types";
import { space } from "@/theme/tokens";

/**
 * Uyusmazlik detayi: misafirin raporu, rezervasyon baglami, muhur kaniti; durum + not.
 * Iade yok: web'de de yok. Para geri gidecekse rezervasyonun yonetici iptali kullanilir.
 */
export default function AdminDisputeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useAdminDispute(id ?? "");
  return (
    <AdminOpsScreen title={t("adminOps.disputes.title")} query={query}>
      {/* Anahtar sunucu durumunu tasir: kayit degisince taslak sifirdan kurulur. */}
      {query.data ? <DisputeBody key={query.data.updatedAt} dispute={query.data} /> : null}
    </AdminOpsScreen>
  );
}

function DisputeBody({ dispute: d }: { dispute: AdminDispute }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<AdminDisputeStatus>(d.status);
  const [note, setNote] = useState(d.adminNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const canMutate = canMutateAdminOps();
  const dirty = status !== d.status || note.trim() !== (d.adminNote ?? "");

  const save = useMutation({
    mutationFn: () =>
      api<AdminDispute>(`/admin/disputes/${encodeURIComponent(d.id)}`, {
        method: "PATCH",
        body: { status, adminNote: note.trim() },
      }),
    onSuccess: () => {
      setError(null);
      notify(t("adminOps.disputes.updated"));
    },
    onError: (e) => setError(adminOpsErrorMessage(e)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminOpsKeys.disputes });
      void qc.invalidateQueries({ queryKey: [...keys.admin, "overview"] });
    },
  });

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("adminOps.disputes.guestReport")}</SectionTitle>
        <Card style={{ gap: space.xs }}>
          <AppText variant="bodyMedium">{t(`adminOps.disputes.reason.${d.reason}`, { defaultValue: d.reason })}</AppText>
          <AppText variant="body">{d.description}</AppText>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("adminOps.disputes.booking")}</SectionTitle>
        <Card style={{ gap: space.xs }}>
          <Line label={t("adminOps.disputes.guest")} value={d.booking.guestName ?? d.booking.guestEmail ?? "—"} />
          <Line label={t("adminOps.disputes.shop")} value={d.booking.shopName ?? "—"} />
          <Line label={t("adminOps.disputes.total")} value={formatMoney(d.booking.totalPrice)} />
          <Line label={t("adminOps.disputes.stay")} value={formatStayRange(d.booking.checkInTime, d.booking.checkOutTime)} />
          <Button
            variant="ghost"
            title={t("adminOps.disputes.openBooking")}
            onPress={() => router.push(`/admin/booking/${d.booking.id}`)}
          />
        </Card>
        <BagPhotos bookingId={d.booking.id} audience="admin" />
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("adminOps.disputes.seals")}</SectionTitle>
        {d.booking.seals.length === 0 ? (
          <AppText variant="caption">{t("adminOps.disputes.noSeals")}</AppText>
        ) : (
          d.booking.seals.map((s) => (
            <View key={s.id} style={opsStyles.row}>
              <AppText variant="bodyMedium">
                {t("adminOps.disputes.sealLine", { number: s.sealNumber, index: s.bagIndex + 1, size: s.bagSize })}
              </AppText>
              {s.photoUrl ? (
                // Kanit gorseli: kucuk resim servisi degil, orijinal (web de oyle).
                <Image
                  source={{ uri: resolveImage(s.photoUrl) ?? undefined }}
                  contentFit="cover"
                  accessibilityLabel={t("adminOps.disputes.photo")}
                  style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 12 }}
                />
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("adminOps.disputes.statusLabel")}</SectionTitle>
        <View style={opsStyles.chips}>
          {DISPUTE_STATUSES.map((s) => (
            <Chip
              key={s}
              soft
              label={t(`adminOps.disputes.status.${s}`)}
              selected={status === s}
              disabled={!canMutate}
              onPress={() => setStatus(s)}
            />
          ))}
        </View>
        <Field
          label={t("adminOps.disputes.noteLabel")}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={DISPUTE_NOTE_MAX}
          editable={canMutate}
          hint={t("adminOps.disputes.noteHint")}
        />
        <Banner body={t("adminOps.disputes.noRefund")} />
        {error ? <Banner tone="danger" body={error} /> : null}
        <Button
          title={t("adminOps.save")}
          disabled={!canMutate || !dirty}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      </View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <AppText variant="caption" style={{ width: 110 }}>
        {label}
      </AppText>
      <AppText variant="body" style={{ flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}
