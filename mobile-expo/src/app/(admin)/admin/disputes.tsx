import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, opsStyles } from "@/components/AdminOps";
import { AppText, Chip } from "@/components/ui";
import { DISPUTE_STATUSES } from "@/lib/admin-ops";
import { formatDay } from "@/lib/format";
import { useAdminDisputes } from "@/lib/queries";
import type { AdminDisputeStatus } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

/** Uyusmazlik listesi; acilista "Acik" suzgeci, web'deki "Tumu" de var. */
export default function AdminDisputesScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AdminDisputeStatus | null>("OPEN");
  const query = useAdminDisputes(status);

  return (
    <AdminOpsScreen title={t("adminOps.disputes.title")} query={query}>
      <View style={opsStyles.chips}>
        <Chip soft label={t("adminOps.disputes.all")} selected={status === null} onPress={() => setStatus(null)} />
        {DISPUTE_STATUSES.map((s) => (
          <Chip key={s} soft label={t(`adminOps.disputes.status.${s}`)} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>
      {query.data?.length === 0 ? <AppText variant="caption">{t("adminOps.disputes.empty")}</AppText> : null}
      {query.data?.map((d) => (
        <Pressable
          key={d.id}
          accessibilityRole="link"
          onPress={() => router.push(`/admin/dispute/${d.id}`)}
          style={({ pressed }) => [opsStyles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
          <View style={opsStyles.rowTop}>
            <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
              {t(`adminOps.disputes.reason.${d.reason}`, { defaultValue: d.reason })} · {d.booking.shopName ?? ""}
            </AppText>
            <AppText variant="caption">{t(`adminOps.disputes.status.${d.status}`, { defaultValue: d.status })}</AppText>
          </View>
          <AppText variant="caption" numberOfLines={2}>
            {d.description}
          </AppText>
          <AppText variant="caption" style={[opsStyles.meta, { marginTop: space.xs }]}>
            {[d.booking.guestName ?? d.booking.guestEmail, t("adminOps.disputes.opened", { date: formatDay(d.createdAt) })]
              .filter(Boolean)
              .join(" · ")}
          </AppText>
        </Pressable>
      ))}
    </AdminOpsScreen>
  );
}
