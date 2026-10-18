import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys } from "@/lib/queries";
import type { BookingDetail, CreateReviewRequest, CreateReviewResponse } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Sunucu `MAX_REVIEW_COMMENT_LENGTH` (ReviewService.ts); asilirsa uc 500 `server_error` doner. */
const MAX_COMMENT = 2000;

/**
 * Teslimden sonra degerlendirme. Uc (`POST reviews`) yalnizca CHECKED_OUT
 * rezervasyonu kabul eder; rezervasyon basina tek yorum (`duplicate_review`).
 * Detay DTO'su yorumun var olup olmadigini tasimiyor, bu yuzden kart
 * CHECKED_OUT'ta hep gorunur ve tekrar yorum sunucu cevabiyla kapanir.
 */
export function GuestReviewCard({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<"sent" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (body: CreateReviewRequest) =>
      api<CreateReviewResponse>("/reviews", { method: "POST", body }),
    onSuccess: () => {
      setError(null);
      setDone("sent");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      // Dukkan puani yorumla birlikte yeniden hesaplanir (ReviewService).
      void queryClient.invalidateQueries({ queryKey: keys.shop(booking.shopId) });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "duplicate_review") {
        setDone("duplicate");
        return;
      }
      setError(errorMessage(e, "review"));
    },
  });

  if (booking.status !== "CHECKED_OUT") return null;

  if (done) {
    return <Banner tone="success" body={t(done === "sent" ? "review.sent" : "review.errors.duplicate_review")} />;
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        title={t("review.open")}
        icon={<Star size={18} color={colors.ink} />}
        onPress={() => setOpen(true)}
      />
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t("review.title")}</AppText>
      <AppText variant="caption">{t("review.hint", { shop: booking.shopName })}</AppText>
      <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel={t("review.ratingLabel")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating === n }}
            accessibilityLabel={t("review.starN", { n })}
            hitSlop={6}
            onPress={() => setRating(n)}
          >
            <Star
              size={34}
              color={n <= rating ? colors.brand : colors.borderStrong}
              fill={n <= rating ? colors.brand : "transparent"}
            />
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel={t("review.commentLabel")}
        value={comment}
        onChangeText={setComment}
        placeholder={t("review.commentPlaceholder")}
        placeholderTextColor={colors.inkMuted}
        maxLength={MAX_COMMENT}
        multiline
        style={styles.input}
      />
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button
        title={t("review.submit")}
        loading={submit.isPending}
        disabled={rating === 0}
        onPress={() => {
          setError(null);
          const trimmed = comment.trim();
          submit.mutate({ bookingId: booking.id, rating, ...(trimmed ? { comment: trimmed } : {}) });
        }}
      />
      <Button variant="secondary" title={t("common.cancel")} onPress={() => setOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  stars: { flexDirection: "row", gap: space.sm, justifyContent: "center", paddingVertical: space.sm },
  input: {
    minHeight: 96,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: "top",
  },
});
