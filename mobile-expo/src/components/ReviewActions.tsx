import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { ReasonSheet } from "@/components/ReasonSheet";
import { AppText } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useBlockReviewAuthor, useReportReview } from "@/lib/queries";
import type { ReviewReportReason } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

/** Sunucudaki `REVIEW_REPORT_REASONS` sirasi. */
const REASONS: readonly ReviewReportReason[] = ["SPAM", "OFFENSIVE", "HARASSMENT", "FALSE_INFO", "PERSONAL_INFO", "OTHER"];

/**
 * Yorum satirinin "Bildir" ve "Bu kullanicinin yorumlarini gizle" baglantilari (App Review
 * 1.2). Oturumsuz goruntuleyen giris ekranina gider. Kural (kendi yorumu, tek bildirim,
 * hiz siniri) sunucuda: `ReviewService.report` / `blockAuthor`.
 */
export function ReviewActions({ reviewId, shopId }: { reviewId: string; shopId: string }) {
  const { t } = useTranslation();
  const { state } = useAuth();
  const signedIn = state.status === "signedIn";
  const report = useReportReview();
  const block = useBlockReviewAuthor(shopId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [note, setNote] = useState("");

  function startReport() {
    if (!signedIn) return router.push("/login");
    setReason(null);
    setNote("");
    report.reset();
    setOpen(true);
  }

  function confirmBlock() {
    if (!signedIn) return router.push("/login");
    Alert.alert(t("review.blockTitle"), t("review.blockBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("review.blockConfirm"),
        style: "destructive",
        onPress: () =>
          block.mutate(reviewId, {
            onSuccess: () => notify(t("review.blockDone")),
            onError: (e) => notify(t("review.actionFailed"), errorMessage(e, "review")),
          }),
      },
    ]);
  }

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={startReport}>
        <AppText variant="caption" style={styles.link}>
          {t("review.report")}
        </AppText>
      </Pressable>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmBlock}>
        <AppText variant="caption" style={styles.link}>
          {t("review.blockAuthor")}
        </AppText>
      </Pressable>
      <ReasonSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t("review.reportTitle")}
        body={t("review.reportBody")}
        choices={REASONS.map((r) => ({ value: r, label: t(`review.reportReason.${r}`) }))}
        selected={reason}
        onSelect={(v) => setReason(v as ReviewReportReason)}
        note={note}
        onNoteChange={setNote}
        noteLabel={t("review.reportNoteLabel")}
        notePlaceholder={t("review.reportNotePlaceholder")}
        confirmLabel={t("review.reportSend")}
        canSubmit={reason !== null}
        loading={report.isPending}
        error={report.isError ? errorMessage(report.error, "review") : null}
        onConfirm={() =>
          reason &&
          report.mutate(
            { id: reviewId, reason, note: note.trim() || undefined },
            {
              onSuccess: () => {
                setOpen(false);
                notify(t("review.reportThanks"));
              },
            },
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.lg, marginTop: 2 },
  link: { color: colors.inkMuted, textDecorationLine: "underline" },
});
