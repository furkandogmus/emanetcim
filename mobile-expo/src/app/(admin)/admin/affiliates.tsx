import { useState } from "react";
import { Share, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { Field } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { AppText, Banner, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { canMutateAdminOps } from "@/lib/admin-ops";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { notify } from "@/lib/notify";
import { adminOpsKeys, useAdminAffiliates } from "@/lib/queries";
import type { AdminAffiliate, AdminAffiliateStatus, AdminAffiliateType } from "@/lib/types";
import { space } from "@/theme/tokens";

const TYPES: AdminAffiliateType[] = ["airbnb_host", "hotel", "guide", "agency", "other"];
const STATUSES: AdminAffiliateStatus[] = ["pending", "active", "paused"];

type Form = {
  displayName: string;
  code: string;
  type: AdminAffiliateType;
  contactEmail: string;
  contactPhone: string;
  commissionRate: string;
  guestDiscountRate: string;
  status: AdminAffiliateStatus;
  linkedUserEmail: string;
};

const EMPTY: Form = {
  displayName: "",
  code: "",
  type: "airbnb_host",
  contactEmail: "",
  contactPhone: "",
  commissionRate: "10",
  guestDiscountRate: "0",
  status: "active",
  linkedUserEmail: "",
};

function toForm(a: AdminAffiliate): Form {
  return {
    displayName: a.displayName,
    code: a.code,
    type: a.type,
    contactEmail: a.contactEmail ?? "",
    contactPhone: a.contactPhone ?? "",
    commissionRate: String(a.commissionRate),
    guestDiscountRate: String(a.guestDiscountRate),
    status: a.status,
    linkedUserEmail: a.linkedUserEmail ?? "",
  };
}

/** Oranlar ve kurallar sunucuda; istemci yalnizca sayiya cevirip gonderir. */
function body(f: Form, notes?: string | null) {
  return {
    ...f,
    commissionRate: Number(f.commissionRate.replace(",", ".")),
    guestDiscountRate: Number(f.guestDiscountRate.replace(",", ".")),
    ...(notes != null ? { notes } : {}),
  };
}

const affiliateError = (e: unknown) => errorMessage(e, "adminOps.affiliates");

/** Araci listesi, olusturma/duzenleme/onay, ay sonu odeme isareti ve odenmemis komisyon CSV'si. */
export default function AdminAffiliatesScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useAdminAffiliates();
  const canMutate = canMutateAdminOps();
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [reference, setReference] = useState("");

  const create = useMutation({
    mutationFn: () => api<{ id: string; code: string }>("/admin/affiliates", { method: "POST", body: body(form) }),
    onSuccess: (r) => {
      setForm(EMPTY);
      setError(null);
      notify(t("adminOps.affiliates.created", { code: r.code }));
    },
    onError: (e) => setError(affiliateError(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminOpsKeys.affiliates }),
  });

  const payout = useMutation({
    mutationFn: () =>
      api<{ count: number; total: number }>("/admin/affiliates/payouts", { method: "POST", body: { month, reference } }),
    onSuccess: (r) => {
      setReference("");
      notify(t("adminOps.affiliates.payoutDone", { count: r.count, total: formatMoney(r.total) }));
    },
    onError: (e) => notify(t("adminOps.affiliates.payoutTitle"), affiliateError(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminOpsKeys.affiliates }),
  });

  // Mobil dosya indirmez: CSV metni paylasim menusune gider (e-posta, Drive, mesaj).
  const csv = useMutation({
    mutationFn: () =>
      api<{ csv: string; filename: string }>(
        `/admin/affiliates/commissions${month ? `?month=${encodeURIComponent(month)}` : ""}`,
      ),
    onSuccess: (r) => void Share.share({ title: r.filename, message: r.csv }).catch(() => undefined),
    onError: (e) => notify(t("adminParityD1.affiliates.shareCsv"), affiliateError(e)),
  });

  return (
    <AdminOpsScreen title={t("adminOps.affiliates.title")} query={query}>
      {canMutate ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle>{t("adminOps.affiliates.payoutTitle")}</SectionTitle>
          <Field label={t("adminOps.affiliates.payoutMonth")} value={month} onChangeText={setMonth} maxLength={7} autoCorrect={false} />
          <Field label={t("adminOps.affiliates.payoutReference")} value={reference} onChangeText={setReference} maxLength={120} />
          <Button
            title={t("adminOps.affiliates.payoutSubmit")}
            loading={payout.isPending}
            disabled={!/^\d{4}-\d{2}$/.test(month) || reference.trim().length < 2}
            onPress={() => payout.mutate()}
          />
          <Button
            variant="secondary"
            title={t("adminParityD1.affiliates.shareCsv")}
            loading={csv.isPending}
            disabled={month !== "" && !/^\d{4}-\d{2}$/.test(month)}
            onPress={() => csv.mutate()}
          />
          <AppText variant="caption">{t("adminParityD1.affiliates.shareCsvHint")}</AppText>
        </Card>
      ) : null}

      {canMutate ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle>{t("adminOps.affiliates.create")}</SectionTitle>
          <AffiliateFields form={form} onChange={setForm} />
          {error ? <Banner tone="danger" body={error} /> : null}
          <Button
            title={t("adminOps.affiliates.submit")}
            loading={create.isPending}
            disabled={form.displayName.trim().length < 2}
            onPress={() => {
              setError(null);
              create.mutate();
            }}
          />
        </Card>
      ) : null}

      {query.data?.length === 0 ? <AppText variant="caption">{t("adminOps.affiliates.empty")}</AppText> : null}
      {query.data?.map((a) => <AffiliateRow key={a.id} affiliate={a} canMutate={canMutate} />)}
    </AdminOpsScreen>
  );
}

function AffiliateFields({ form, onChange }: { form: Form; onChange: (f: Form) => void }) {
  const { t } = useTranslation();
  const set = (patch: Partial<Form>) => onChange({ ...form, ...patch });
  return (
    <>
      <Field label={t("adminOps.affiliates.displayName")} value={form.displayName} onChangeText={(displayName) => set({ displayName })} maxLength={120} />
      <Field
        label={t("adminOps.affiliates.code")}
        value={form.code}
        onChangeText={(code) => set({ code })}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={32}
        hint={t("adminOps.affiliates.codeHint")}
      />
      <AppText variant="label">{t("adminOps.affiliates.type")}</AppText>
      <Segmented options={TYPES.map((v) => ({ value: v, label: t(`adminOps.affiliates.types.${v}`) }))} value={form.type} onChange={(type) => set({ type })} />
      <Field label={t("adminOps.affiliates.contactEmail")} value={form.contactEmail} onChangeText={(contactEmail) => set({ contactEmail })} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t("adminOps.affiliates.contactPhone")} value={form.contactPhone} onChangeText={(contactPhone) => set({ contactPhone })} keyboardType="phone-pad" />
      <Field
        label={t("adminOps.affiliates.linkedUserEmail")}
        value={form.linkedUserEmail}
        onChangeText={(linkedUserEmail) => set({ linkedUserEmail })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field label={t("adminOps.affiliates.commissionRate")} value={form.commissionRate} onChangeText={(commissionRate) => set({ commissionRate })} keyboardType="decimal-pad" />
      <Field
        label={t("adminOps.affiliates.guestDiscountRate")}
        value={form.guestDiscountRate}
        onChangeText={(guestDiscountRate) => set({ guestDiscountRate })}
        keyboardType="decimal-pad"
      />
      <AppText variant="label">{t("adminOps.affiliates.status")}</AppText>
      <Segmented options={STATUSES.map((v) => ({ value: v, label: t(`adminOps.affiliates.statuses.${v}`) }))} value={form.status} onChange={(status) => set({ status })} />
    </>
  );
}

function AffiliateRow({ affiliate: a, canMutate }: { affiliate: AdminAffiliate; canMutate: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(a));
  const save = useMutation({
    mutationFn: (f: Form) =>
      api<{ success: true }>(`/admin/affiliates/${encodeURIComponent(a.id)}`, { method: "PATCH", body: body(f, a.notes) }),
    onSuccess: () => {
      setEditing(false);
      notify(t("adminOps.saved"));
    },
    onError: (e) => notify(t("adminOps.affiliates.title"), affiliateError(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminOpsKeys.affiliates }),
  });
  const s = a.stats;
  return (
    <View style={opsStyles.row} testID={`affiliate-${a.code}`}>
      <View style={opsStyles.rowTop}>
        <AppText variant="bodyMedium" style={{ flex: 1 }}>
          {a.displayName} · {a.code}
        </AppText>
        <AppText variant="caption">{t(`adminOps.affiliates.statuses.${a.status}`)}</AppText>
      </View>
      <AppText variant="caption" style={opsStyles.meta}>
        {[
          t(`adminOps.affiliates.types.${a.type}`),
          t("adminOps.affiliates.rates", { commission: a.commissionRate, discount: a.guestDiscountRate }),
        ].join(" · ")}
      </AppText>
      <AppText variant="caption" style={opsStyles.meta}>
        {t("adminOps.affiliates.statsLine", {
          clicks: s.clicks,
          bookings: s.bookings,
          completed: s.completedBookings,
          unpaid: formatMoney(s.unpaid),
          paid: formatMoney(s.paid),
        })}
      </AppText>
      {a.applicationNote ? <AppText variant="caption">{a.applicationNote}</AppText> : null}
      {canMutate && a.status === "pending" ? (
        <Button title={t("adminOps.affiliates.approve")} loading={save.isPending} onPress={() => save.mutate({ ...toForm(a), status: "active" })} />
      ) : null}
      {canMutate ? (
        <Button variant="secondary" title={editing ? t("common.cancel") : t("adminOps.edit")} onPress={() => setEditing((v) => !v)} />
      ) : null}
      {editing ? (
        <View style={{ gap: space.md }}>
          <AffiliateFields form={form} onChange={setForm} />
          <Button title={t("adminOps.save")} loading={save.isPending} onPress={() => save.mutate(form)} />
        </View>
      ) : null}
    </View>
  );
}
