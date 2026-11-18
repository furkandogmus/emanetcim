import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Luggage } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { BookingDetail } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Esnaf valiz sayisini tutari artiracak sekilde duzelttiginde misafirin onayi.
 * Onaylanirsa yeni tutar hemen uygulanir; reddedilirse oneri silinir.
 */
export function GuestBagRevisionCard({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const pending = booking.pendingBagRevision;

  const decide = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      api<{ success: true; newTotal: number | null }>(`/bookings/${booking.id}/bag-revision`, {
        method: "POST",
        // Gorulen tutar: arada degistiyse sunucu 409 `revision_changed` doner.
        body: { action, expectedNewTotal: booking.pendingBagRevision?.newTotal },
      }),
    onSuccess: (res, action) => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      if (action === "approve") {
        notify(t("guestRevision.approvedTitle"), t("guestRevision.approvedBody", { total: formatMoney(res.newTotal ?? 0) }));
      } else {
        notify(t("guestRevision.rejectedTitle"), t("guestRevision.rejectedBody"));
      }
    },
    onError: (e) => {
      setError(errorMessage(e, "bagRevision"));
      // Oneri degistiyse yenisi gelsin: misafir guncel tutari gorup karar versin.
      if (e instanceof ApiError && e.code === "revision_changed") {
        void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      }
    },
  });

  if (!pending) return null;
  const from = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  const to = pending.bagCountS + pending.bagCountM + pending.bagCountXl;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Luggage size={18} strokeWidth={1.75} color={colors.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{t("guestRevision.title")}</AppText>
          <AppText variant="caption">{t("guestRevision.body", { shop: booking.shopName })}</AppText>
        </View>
      </View>

      <View style={styles.rows}>
        <Row label={t("guestRevision.bags")} value={t("bagRevision.delta", { from, to })} />
        <Row label={t("guestRevision.extra")} value={`+${formatMoney(pending.extraAmount)}`} />
        <Row label={t("guestRevision.newTotal")} value={formatMoney(pending.newTotal)} strong />
      </View>

      {error ? <Banner tone="danger" body={error} /> : null}

      <View style={styles.actions}>
        <Button
          variant="secondary"
          title={t("guestRevision.reject")}
          style={{ flex: 1 }}
          disabled={decide.isPending}
          loading={decide.isPending && decide.variables === "reject"}
          onPress={() => decide.mutate("reject")}
        />
        <Button
          title={t("guestRevision.approve")}
          style={{ flex: 1 }}
          disabled={decide.isPending}
          loading={decide.isPending && decide.variables === "approve"}
          onPress={() => decide.mutate("approve")}
        />
      </View>
      <AppText variant="caption">{t("guestRevision.note")}</AppText>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant="body" style={{ flex: 1, color: colors.inkSecondary }}>
        {label}
      </AppText>
      <AppText variant={strong ? "heading" : "bodyMedium"} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, borderColor: colors.accent, borderWidth: 1 },
  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rows: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  actions: { flexDirection: "row", gap: space.sm },
});
