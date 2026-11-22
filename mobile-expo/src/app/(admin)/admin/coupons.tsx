import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { Field } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { AppText, Banner, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import {
  EMPTY_COUPON_FORM,
  adminOpsErrorMessage,
  canMutateAdminOps,
  couponBody,
  couponFormIssues,
  type CouponForm,
} from "@/lib/admin-ops";
import { formatDay, formatMoney } from "@/lib/format";
import { notify } from "@/lib/notify";
import { adminOpsKeys, useAdminCoupons } from "@/lib/queries";
import type { AdminCoupon } from "@/lib/types";
import { space } from "@/theme/tokens";

/** Kupon listesi, olusturma ve acma/kapatma. Silme ve duzenleme yok: web de yalniz bunlari yapiyor. */
export default function AdminCouponsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useAdminCoupons();
  const [form, setForm] = useState<CouponForm>(EMPTY_COUPON_FORM);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canMutate = canMutateAdminOps();
  const issues = couponFormIssues(form);
  const set = (patch: Partial<CouponForm>) => setForm((f) => ({ ...f, ...patch }));
  const issue = (k: keyof CouponForm) => (touched && issues.includes(k) ? t(`adminOps.coupons.invalid.${k}`) : undefined);

  const create = useMutation({
    mutationFn: () => api<{ id: string; code: string }>("/admin/coupons", { method: "POST", body: couponBody(form) }),
    onSuccess: () => {
      setForm(EMPTY_COUPON_FORM);
      setTouched(false);
      setError(null);
      notify(t("adminOps.coupons.created"));
    },
    onError: (e) => setError(adminOpsErrorMessage(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminOpsKeys.coupons }),
  });

  return (
    <AdminOpsScreen title={t("adminOps.coupons.title")} query={query}>
      {canMutate ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle>{t("adminOps.coupons.create")}</SectionTitle>
          <Field
            label={t("adminOps.coupons.code")}
            value={form.code}
            onChangeText={(code) => set({ code })}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
            hint={issue("code") ?? t("adminOps.coupons.codeHint")}
          />
          <Segmented
            options={[
              { value: "percent", label: t("adminOps.coupons.typePercent") },
              { value: "fixed", label: t("adminOps.coupons.typeFixed") },
            ]}
            value={form.isPercent ? "percent" : "fixed"}
            onChange={(v) => set({ isPercent: v === "percent" })}
          />
          <Field
            label={t("adminOps.coupons.discount")}
            value={form.discount}
            onChangeText={(discount) => set({ discount })}
            keyboardType="decimal-pad"
            hint={issue("discount")}
          />
          <Field
            label={t("adminOps.coupons.minPrice")}
            value={form.minPrice}
            onChangeText={(minPrice) => set({ minPrice })}
            keyboardType="decimal-pad"
            hint={issue("minPrice")}
          />
          <Field
            label={t("adminOps.coupons.maxUses")}
            value={form.maxUses}
            onChangeText={(maxUses) => set({ maxUses })}
            keyboardType="number-pad"
            hint={issue("maxUses")}
          />
          <Field
            label={t("adminOps.coupons.expiresOn")}
            value={form.expiresOn}
            onChangeText={(expiresOn) => set({ expiresOn })}
            autoCorrect={false}
            maxLength={10}
            hint={issue("expiresOn")}
          />
          {error ? <Banner tone="danger" body={error} /> : null}
          <Button
            title={t("adminOps.coupons.submit")}
            loading={create.isPending}
            onPress={() => {
              setTouched(true);
              setError(null);
              if (issues.length === 0) create.mutate();
            }}
          />
        </Card>
      ) : null}

      <AppText variant="caption">{t("adminOps.coupons.noDelete")}</AppText>
      {query.data?.length === 0 ? <AppText variant="caption">{t("adminOps.coupons.empty")}</AppText> : null}
      {query.data?.map((c) => <CouponRow key={c.id} coupon={c} canMutate={canMutate} />)}
    </AdminOpsScreen>
  );
}

function CouponRow({ coupon: c, canMutate }: { coupon: AdminCoupon; canMutate: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: () =>
      api<{ success: true }>(`/admin/coupons/${encodeURIComponent(c.id)}`, { method: "PATCH", body: { isActive: !c.isActive } }),
    onError: (e) => notify(t("adminOps.coupons.title"), adminOpsErrorMessage(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminOpsKeys.coupons }),
  });
  const discount = c.isPercent ? `%${c.discount}` : formatMoney(c.discount);
  return (
    <View style={opsStyles.row} testID={`coupon-${c.code}`}>
      <View style={opsStyles.rowTop}>
        <AppText variant="bodyMedium" style={{ flex: 1 }}>
          {c.code} · {discount}
        </AppText>
        <AppText variant="caption">{c.isActive ? t("adminOps.coupons.active") : t("adminOps.coupons.inactive")}</AppText>
      </View>
      <AppText variant="caption" style={opsStyles.meta}>
        {[
          c.maxUses == null
            ? t("adminOps.coupons.usedUnlimited", { used: c.usedCount })
            : t("adminOps.coupons.used", { used: c.usedCount, max: c.maxUses }),
          c.expiresAt ? t("adminOps.coupons.expires", { date: formatDay(c.expiresAt) }) : t("adminOps.coupons.noExpiry"),
          c.minPrice ? t("adminOps.coupons.minPriceLine", { amount: formatMoney(c.minPrice) }) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </AppText>
      {canMutate ? (
        <Button
          variant={c.isActive ? "danger" : "secondary"}
          title={c.isActive ? t("adminOps.coupons.deactivate") : t("adminOps.coupons.activate")}
          loading={toggle.isPending}
          onPress={() => toggle.mutate()}
        />
      ) : null}
    </View>
  );
}
