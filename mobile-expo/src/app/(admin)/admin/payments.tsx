import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { AppText, Banner, Card, Chip } from "@/components/ui";
import { formatDayTime, formatMoney } from "@/lib/format";
import { useAdminPayments } from "@/lib/queries";
import { space } from "@/theme/tokens";

/** Web `/admin/payments` ile ayni suzgecler. */
const STATUS_FILTERS = ["ALL", "PENDING", "AUTHORIZED", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED"] as const;

/** Odeme defteri: SALT OKUNUR. Tutarlar sunucudan; istemci hicbir sey hesaplamaz. */
export default function AdminPaymentsScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const query = useAdminPayments(status);
  const d = query.data;

  return (
    <AdminOpsScreen title={t("adminOps.payments.title")} query={query}>
      <Banner body={t("adminOps.payments.readOnly")} />
      {d ? (
        <>
          <Card style={{ gap: space.md }}>
            <Figure
              label={t("adminOps.payments.captured")}
              value={formatMoney(d.summary.capturedAmount)}
              foot={t("adminOps.payments.capturedCount", { count: d.summary.capturedCount })}
            />
            <Figure label={t("adminOps.payments.refunded")} value={formatMoney(d.summary.refundedAmount)} />
            <Figure
              label={t("adminOps.payments.pendingSplit")}
              value={formatMoney(d.summary.pendingSplitAmount)}
              foot={t("adminOps.payments.pendingSplitCount", { count: d.summary.pendingSplitCount })}
            />
            <Figure label={t("adminOps.payments.failed")} value={String(d.summary.failedCount)} />
          </Card>

          <View style={opsStyles.chips}>
            {STATUS_FILTERS.map((s) => (
              <Chip
                key={s}
                soft
                label={s === "ALL" ? t("adminOps.payments.all") : t(`adminOps.payments.status.${s}`)}
                selected={status === s}
                onPress={() => setStatus(s)}
              />
            ))}
          </View>

          {d.payments.length === 0 ? <AppText variant="caption">{t("adminOps.payments.empty")}</AppText> : null}
          {d.payments.map((p) => (
            <View key={p.id} style={opsStyles.row}>
              <View style={opsStyles.rowTop}>
                <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                  {p.shopName}
                </AppText>
                <AppText variant="bodyMedium" style={opsStyles.meta}>
                  {formatMoney(p.amount)}
                </AppText>
              </View>
              <AppText variant="caption" style={opsStyles.meta}>
                {[
                  t(`adminOps.payments.status.${p.status}`, { defaultValue: p.status }),
                  p.guestLabel ?? t("adminOps.payments.anonymous"),
                  formatDayTime(p.createdAt),
                  p.provider,
                ].join(" · ")}
              </AppText>
              {p.merchantAmount != null ? (
                <AppText variant="caption" style={opsStyles.meta}>
                  {[
                    t("adminOps.payments.merchantShare", { amount: formatMoney(p.merchantAmount) }),
                    t("adminOps.payments.commission", { amount: formatMoney(p.platformCommission ?? 0) }),
                    p.splitStatus ? t(`adminOps.payments.split.${p.splitStatus}`, { defaultValue: p.splitStatus }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              ) : null}
              {p.refundedAmount > 0 ? (
                <AppText variant="caption" style={opsStyles.meta}>
                  {t("adminOps.payments.refundedLine", { amount: formatMoney(p.refundedAmount) })}
                </AppText>
              ) : null}
              {p.failureReason ? <AppText variant="caption">{p.failureReason}</AppText> : null}
            </View>
          ))}
          {d.payments.length >= 100 ? <AppText variant="caption">{t("adminOps.payments.limitNote")}</AppText> : null}

          <SectionTitle>{t("adminOps.payments.accounts")}</SectionTitle>
          {d.accounts.length === 0 ? <AppText variant="caption">{t("adminOps.payments.accountsEmpty")}</AppText> : null}
          {d.accounts.map((a) => (
            <View key={a.id} style={opsStyles.row}>
              <View style={opsStyles.rowTop}>
                <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                  {a.shopName}
                </AppText>
                <AppText variant="caption">{t(`adminOps.payments.account.${a.status}`, { defaultValue: a.status })}</AppText>
              </View>
              <AppText variant="caption" style={opsStyles.meta}>
                {[a.city, a.provider, a.activatedAt ? formatDayTime(a.activatedAt) : null].filter(Boolean).join(" · ")}
              </AppText>
              {a.rejectionReason ? <AppText variant="caption">{a.rejectionReason}</AppText> : null}
            </View>
          ))}
        </>
      ) : null}
    </AdminOpsScreen>
  );
}

function Figure({ label, value, foot }: { label: string; value: string; foot?: string }) {
  return (
    <View style={{ gap: 2 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="bodyMedium" style={opsStyles.meta}>
        {value}
      </AppText>
      {foot ? <AppText variant="caption">{foot}</AppText> : null}
    </View>
  );
}
