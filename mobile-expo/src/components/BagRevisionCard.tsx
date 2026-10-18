import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilLine } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagCounter } from "@/components/BagCounter";
import { AppText, Banner, Button, Card } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import type { BagRevisionRequest, BagRevisionResponse, BookingDetail } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, space } from "@/theme/tokens";

/** `REVISABLE_STATUSES` (src/services/booking/bag-revision.ts); sunucu yine de reddeder. */
const REVISABLE = new Set(["APPROVED", "PAID", "CHECKED_IN"]);

/**
 * Misafir rezervasyondakinden farkli sayida valizle geldiginde esnafin duzeltmesi.
 * Fark tutari burada TAHMIN EDILMEZ (web `BagRevisionDialog` ile ayni gerekce):
 * tezgahta misafire yanlis rakam soyletmemek icin kesin toplam sunucudan gelir.
 */
export function BagRevisionCard({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const initial: BagRevisionRequest = {
    bagCountS: booking.bagCountS,
    bagCountM: booking.bagCountM,
    bagCountXl: booking.bagCountXl,
  };
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["partner"] });
  };

  const revise = useMutation({
    mutationFn: (body: BagRevisionRequest) =>
      api<BagRevisionResponse>(`/partner/bookings/${booking.id}/bag-revision`, { method: "POST", body }),
    onSuccess: (res) => {
      setError(null);
      setOpen(false);
      refresh();
      notify(t("bagRevision.savedTitle"), t("bagRevision.savedBody", { total: formatMoney(res.newTotal) }));
    },
    onError: (e) => {
      // 409 ama hata degil: oneri kaydedildi, misafire onay e-postasi gitti.
      if (e instanceof ApiError && e.code === "guest_approval_required") {
        setError(null);
        setOpen(false);
        refresh();
        notify(t("bagRevision.approvalTitle"), t("bagRevision.approvalBody"));
        return;
      }
      setError(errorMessage(e, "bagRevision"));
    },
  });

  if (!REVISABLE.has(booking.status)) return null;

  if (!open) {
    return (
      <Button
        variant="secondary"
        title={t("bagRevision.open")}
        icon={<PencilLine size={18} color={colors.ink} />}
        onPress={() => {
          setCounts(initial);
          setError(null);
          setOpen(true);
        }}
      />
    );
  }

  const total = counts.bagCountS + counts.bagCountM + counts.bagCountXl;
  const initialTotal = initial.bagCountS + initial.bagCountM + initial.bagCountXl;
  const changed =
    counts.bagCountS !== initial.bagCountS ||
    counts.bagCountM !== initial.bagCountM ||
    counts.bagCountXl !== initial.bagCountXl;

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t("bagRevision.title")}</AppText>
      <AppText variant="caption">
        {booking.status === "CHECKED_IN" ? t("bagRevision.hintCheckedIn") : t("bagRevision.hint")}
      </AppText>
      <BagCounter size="s" value={counts.bagCountS} onChange={(n) => setCounts((c) => ({ ...c, bagCountS: n }))} />
      <BagCounter size="m" value={counts.bagCountM} onChange={(n) => setCounts((c) => ({ ...c, bagCountM: n }))} />
      <BagCounter size="xl" value={counts.bagCountXl} onChange={(n) => setCounts((c) => ({ ...c, bagCountXl: n }))} />
      {changed ? (
        <AppText variant="label" style={styles.delta} accessibilityLiveRegion="polite">
          {t("bagRevision.delta", { from: initialTotal, to: total })}
        </AppText>
      ) : null}
      {total === 0 ? <Banner tone="warning" body={t("bagRevision.atLeastOne")} /> : null}
      {error ? <Banner tone="danger" body={error} /> : null}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          title={t("common.cancel")}
          disabled={revise.isPending}
          onPress={() => setOpen(false)}
          style={{ flex: 1 }}
        />
        <Button
          title={t("bagRevision.apply")}
          loading={revise.isPending}
          disabled={!changed || total === 0}
          onPress={() => revise.mutate(counts)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  delta: { textAlign: "center", color: colors.warning },
  actions: { flexDirection: "row", gap: space.md },
});
