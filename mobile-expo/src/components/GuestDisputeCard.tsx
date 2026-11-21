import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card, Chip } from "@/components/ui";
import { Input } from "@/components/Field";
import { ApiError, api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type {
  BookingDetail,
  CreateDisputeRequest,
  CreateDisputeResponse,
  DisputeReason,
} from "@/lib/types";
import { disputeStatusView } from "@/lib/dispute-view";
import { colors, space } from "@/theme/tokens";

/** `DISPUTABLE_STATUSES` (DisputeService.ts): valiz dukkana teslim edilmis olmali. */
const DISPUTABLE = new Set(["CHECKED_IN", "CHECKED_OUT"]);
const REASONS: DisputeReason[] = ["DAMAGE", "THEFT", "OTHER"];
/** Uc semasi (`api/mobile/disputes`): aciklama 10-2000 karakter, kirpilmis. */
const MIN_DESC = 10;
const MAX_DESC = 2000;

/**
 * Hasar / kayip / diger sikayeti. Rezervasyon basina tek kayit
 * (`duplicate_dispute`); durumu DTO'dan (`disputeStatus`) okunur.
 */
export function GuestDisputeCard({ booking, onOpen }: { booking: BookingDetail; onOpen?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [done, setDone] = useState<"sent" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (body: CreateDisputeRequest) =>
      api<CreateDisputeResponse>("/disputes", { method: "POST", body }),
    onSuccess: () => {
      setError(null);
      setDone("sent");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "duplicate_dispute") {
        setDone("duplicate");
        return;
      }
      setError(errorMessage(e, "dispute"));
    },
  });

  if (!DISPUTABLE.has(booking.status)) return null;

  if (done === "sent") return <Banner tone="success" body={t("dispute.sent")} />;
  if (done === "duplicate" || booking.hasDispute) {
    const view = disputeStatusView(booking.disputeStatus);
    return <Banner tone={view.tone} body={t(view.key)} />;
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        title={t("dispute.open")}
        icon={<TriangleAlert size={18} color={colors.warning} />}
        onPress={() => {
          setOpen(true);
          onOpen?.();
        }}
      />
    );
  }

  const trimmed = description.trim();
  const tooShort = trimmed.length < MIN_DESC;

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t("dispute.title")}</AppText>
      <AppText variant="caption">{t("dispute.hint")}</AppText>
      <AppText variant="bodyMedium">{t("dispute.reasonLabel")}</AppText>
      <View style={styles.reasons} accessibilityLabel={t("dispute.reasonLabel")}>
        {REASONS.map((r) => (
          <Chip key={r} soft label={t(`dispute.reasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Input
        accessibilityLabel={t("dispute.descriptionLabel")}
        value={description}
        onChangeText={setDescription}
        placeholder={t("dispute.descriptionPlaceholder")}
        placeholderTextColor={colors.inkMuted}
        maxLength={MAX_DESC}
        multiline
        style={{ minHeight: 120 }}
      />
      {description.length > 0 && tooShort ? (
        <AppText variant="caption">{t("dispute.descriptionMin", { n: MIN_DESC })}</AppText>
      ) : null}
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button
        title={t("dispute.submit")}
        loading={submit.isPending}
        disabled={!reason || tooShort}
        onPress={() => {
          if (!reason) return;
          setError(null);
          submit.mutate({ bookingId: booking.id, reason, description: trimmed });
        }}
      />
      <Button variant="secondary" title={t("common.cancel")} onPress={() => setOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
