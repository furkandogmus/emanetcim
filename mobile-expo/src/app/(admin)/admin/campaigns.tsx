import { useState } from "react";
import { Alert, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { Field } from "@/components/Field";
import { TonePill } from "@/components/TonePill";
import { AppText, Banner, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import {
  EMPTY_CAMPAIGN_FORM,
  campaignBody,
  campaignFormIssues,
  campaignToForm,
  isCampaignExpired,
  type CampaignForm,
} from "@/lib/admin-campaigns";
import { canMutateAdminOps } from "@/lib/admin-ops";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { adminCampaignKeys, useAdminCampaigns } from "@/lib/queries";
import type { AdminCampaign } from "@/lib/types";
import { space } from "@/theme/tokens";

const campaignError = (e: unknown) => errorMessage(e, "adminCampaigns");

/**
 * Kampanyalar: olustur, duzenle, duraklat/surdur, sil. Sema ve denetim kaydi
 * web ile ortak (`CampaignService`); silme onay ister.
 */
export default function AdminCampaignsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useAdminCampaigns();
  const canMutate = canMutateAdminOps();
  const [form, setForm] = useState<CampaignForm>(EMPTY_CAMPAIGN_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = campaignFormIssues(form);
  const set = (patch: Partial<CampaignForm>) => setForm((f) => ({ ...f, ...patch }));
  const issue = (k: keyof CampaignForm) => (touched && issues.includes(k) ? t(`adminCampaigns.invalid.${k}`) : undefined);
  const reset = () => {
    setForm(EMPTY_CAMPAIGN_FORM);
    setEditingId(null);
    setTouched(false);
    setError(null);
  };
  const invalidate = () => void qc.invalidateQueries({ queryKey: adminCampaignKeys.list });

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? api(`/admin/campaigns/${encodeURIComponent(editingId)}`, { method: "PATCH", body: campaignBody(form) })
        : api<{ id: string }>("/admin/campaigns", { method: "POST", body: { ...campaignBody(form), isActive: true } }),
    onSuccess: () => {
      notify(editingId ? t("adminCampaigns.updated") : t("adminCampaigns.created"));
      reset();
    },
    onError: (e) => setError(campaignError(e)),
    onSettled: invalidate,
  });

  const startEdit = (c: AdminCampaign) => {
    setEditingId(c.id);
    setForm(campaignToForm(c));
    setTouched(false);
    setError(null);
  };

  return (
    <AdminOpsScreen title={t("adminCampaigns.title")} query={query}>
      {canMutate ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle>{editingId ? t("adminCampaigns.editTitle") : t("adminCampaigns.createTitle")}</SectionTitle>
          <Field
            label={t("adminCampaigns.name")}
            value={form.name}
            onChangeText={(name) => set({ name })}
            maxLength={200}
            hint={issue("name")}
          />
          <Field
            label={t("adminCampaigns.message")}
            value={form.message}
            onChangeText={(message) => set({ message })}
            multiline
            maxLength={1000}
            hint={issue("message")}
          />
          <Field
            label={t("adminCampaigns.discount")}
            value={form.discount}
            onChangeText={(discount) => set({ discount })}
            keyboardType="decimal-pad"
            hint={issue("discount") ?? t("adminCampaigns.discountHint")}
          />
          <Field
            label={t("adminCampaigns.endsAt")}
            value={form.endsAt}
            onChangeText={(endsAt) => set({ endsAt })}
            placeholder="2026-12-31"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            hint={issue("endsAt") ?? t("adminCampaigns.endsAtHint")}
          />
          {error ? <Banner tone="danger" body={error} /> : null}
          <Button
            title={editingId ? t("adminCampaigns.save") : t("adminCampaigns.create")}
            loading={save.isPending}
            onPress={() => {
              setTouched(true);
              if (issues.length === 0) save.mutate();
            }}
          />
          {editingId ? <Button variant="secondary" title={t("adminCampaigns.cancelEdit")} onPress={reset} /> : null}
        </Card>
      ) : null}

      <SectionTitle>{t("adminCampaigns.listTitle")}</SectionTitle>
      {query.data?.length === 0 ? <AppText variant="caption">{t("adminCampaigns.empty")}</AppText> : null}
      {query.data?.map((c) => (
        <CampaignRow
          key={c.id}
          campaign={c}
          canMutate={canMutate}
          editing={editingId === c.id}
          onEdit={() => startEdit(c)}
          onDeleted={() => {
            if (editingId === c.id) reset();
            invalidate();
          }}
          onChanged={invalidate}
        />
      ))}
    </AdminOpsScreen>
  );
}

function CampaignRow({
  campaign: c,
  canMutate,
  editing,
  onEdit,
  onDeleted,
  onChanged,
}: {
  campaign: AdminCampaign;
  canMutate: boolean;
  editing: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const expired = isCampaignExpired(c);
  const toggle = useMutation({
    mutationFn: () =>
      api(`/admin/campaigns/${encodeURIComponent(c.id)}`, { method: "PATCH", body: { isActive: !c.isActive } }),
    onSuccess: () => notify(c.isActive ? t("adminCampaigns.paused") : t("adminCampaigns.resumed")),
    onError: (e) => notify(t("adminCampaigns.failed"), campaignError(e)),
    onSettled: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/campaigns/${encodeURIComponent(c.id)}`, { method: "DELETE" }),
    onSuccess: () => notify(t("adminCampaigns.deleted")),
    onError: (e) => notify(t("adminCampaigns.failed"), campaignError(e)),
    onSettled: onDeleted,
  });
  const confirmDelete = () =>
    Alert.alert(t("adminCampaigns.deleteTitle"), t("adminCampaigns.deleteBody", { name: c.name }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("adminCampaigns.delete"), style: "destructive", onPress: () => remove.mutate() },
    ]);

  return (
    <View style={opsStyles.row} testID={`campaign-${c.id}`}>
      <View style={opsStyles.rowTop}>
        <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={2}>
          {c.name}
        </AppText>
        <TonePill
          tone={!c.isActive ? "muted" : expired ? "warning" : "ok"}
          label={!c.isActive ? t("adminCampaigns.statePaused") : expired ? t("adminCampaigns.stateExpired") : t("adminCampaigns.stateActive")}
        />
      </View>
      <AppText variant="caption" style={opsStyles.meta}>
        {[
          c.discountPercent != null ? t("adminCampaigns.discountLine", { pct: c.discountPercent }) : null,
          c.endsAt ? t("adminCampaigns.endsLine", { date: formatDay(c.endsAt) }) : t("adminCampaigns.noEnd"),
        ]
          .filter(Boolean)
          .join(" · ")}
      </AppText>
      {c.message ? (
        <AppText variant="caption" numberOfLines={3}>
          {c.message}
        </AppText>
      ) : null}
      {canMutate ? (
        <View style={{ flexDirection: "row", gap: space.sm, paddingTop: space.xs }}>
          <Button
            variant="secondary"
            style={{ flex: 1 }}
            title={c.isActive ? t("adminCampaigns.pause") : t("adminCampaigns.resume")}
            loading={toggle.isPending}
            onPress={() => toggle.mutate()}
          />
          <Button variant="secondary" style={{ flex: 1 }} title={t("adminCampaigns.edit")} disabled={editing} onPress={onEdit} />
          <Button variant="danger" style={{ flex: 1 }} title={t("adminCampaigns.delete")} loading={remove.isPending} onPress={confirmDelete} />
        </View>
      ) : null}
    </View>
  );
}
