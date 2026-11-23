import { StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ReviewActions } from "@/components/ReviewActions";
import { AppText } from "@/components/ui";
import { formatDay } from "@/lib/format";
import type { ShopReview } from "@/lib/types";
import { colors } from "@/theme/tokens";

/**
 * Tek yorum satiri: dukkan ekranindaki ozet ve "Tum yorumlar" listesi ayni bicimi kullanir.
 * `shopId` verilince bildir/gizle baglantilari cizilir (App Review 1.2).
 */
export function ReviewItem({ review: r, shopId }: { review: ShopReview; shopId?: string }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.meta}>
        <Star size={14} color={colors.brand} fill={colors.brand} />
        <AppText variant="bodyMedium">{r.rating}</AppText>
        <AppText variant="caption">
          {r.authorLabel || t("partner.guest")} · {formatDay(r.createdAt)}
        </AppText>
      </View>
      {r.comment ? <AppText variant="body">{r.comment}</AppText> : null}
      {shopId ? <ReviewActions reviewId={r.id} shopId={shopId} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
});
