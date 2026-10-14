import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { StatusBadge } from "@/components/StatusBadge";
import { AppText } from "@/components/ui";
import { formatDayTime, formatMoney } from "@/lib/format";
import type { BookingSummary } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";

/** Liste satiri; `title` misafirde dukkan adi, esnafta misafir adi. */
export function BookingRow({
  booking,
  title,
  onPress,
  highlight,
}: {
  booking: BookingSummary;
  title: string;
  onPress: () => void;
  highlight?: string;
}) {
  const { t } = useTranslation();
  const bags = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.badges}>
          <StatusBadge status={booking.status} />
          {highlight ? (
            <View style={styles.highlight}>
              <AppText variant="label" style={{ color: colors.white, fontSize: 12 }}>
                {highlight}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption">
          {formatDayTime(booking.checkInTime)} → {formatDayTime(booking.checkOutTime)}
        </AppText>
        <AppText variant="caption">
          {t("common.bag", { count: bags })} · {formatMoney(booking.totalPrice)}
        </AppText>
      </View>
      <ChevronRight size={22} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badges: { flexDirection: "row", gap: space.sm },
  highlight: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
