import { memo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { StatusBadge } from "@/components/StatusBadge";
import { AppText } from "@/components/ui";
import { prefetchBooking } from "@/lib/queries";
import { formatDayTime, formatMoney, formatMonthShort, formatTime } from "@/lib/format";
import { shiftedForFormat } from "@/lib/time";
import type { BookingSummary } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * Liste satiri; `title` misafirde dukkan adi, esnafta misafir adi.
 * Soldaki gun karosu fisin (BookingTicket) imzasi: liste bir takvim gibi taranir.
 */
export const BookingRow = memo(function BookingRow({
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
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const bags = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  const day = shiftedForFormat(booking.checkInTime);
  const month = formatMonthShort(booking.checkInTime);
  const faded = booking.status === "CANCELLED" || booking.status === "CHECKED_OUT";
  // Satir acildigi anki saat yeterli; render saf kalsin (liste yenilenince yeniden kurulur).
  const [now] = useState(() => Date.now());
  // Alma saati gecmis ama valiz hala dukkanda: esnaf da misafir de bunu satirda gormeli.
  const overdueMs = booking.status === "CHECKED_IN" ? now - new Date(booking.checkOutTime).getTime() : 0;
  const overdueDays = Math.floor(overdueMs / 86_400_000);

  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={() => prefetchBooking(queryClient, booking.id)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={[styles.dateTile, faded && { opacity: 0.55 }]}>
        <AppText style={styles.dateDay}>{day.getUTCDate()}</AppText>
        <AppText variant="label" style={styles.dateMonth}>
          {month}
        </AppText>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {formatTime(booking.checkInTime)} → {formatDayTime(booking.checkOutTime)}
        </AppText>
        {overdueMs > 0 ? (
          <AppText variant="label" style={{ color: colors.danger, fontSize: 13 }}>
            {overdueDays >= 1 ? t("bookings.overdueDays", { count: overdueDays }) : t("bookings.overdue")}
          </AppText>
        ) : null}
        <View style={styles.meta}>
          <StatusBadge status={booking.status} checkOutTime={booking.checkOutTime} />
          {highlight ? (
            <View style={styles.highlight}>
              <AppText variant="label" style={{ color: colors.white, fontSize: 12 }}>
                {highlight}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        <AppText variant="bodyMedium" style={{ fontFamily: fonts.bodySemibold, fontVariant: ["tabular-nums"] }}>
          {formatMoney(booking.totalPrice)}
        </AppText>
        <AppText variant="caption" style={{ fontSize: 13 }}>
          {t("common.bag", { count: bags })}
        </AppText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateTile: {
    width: 52,
    paddingVertical: space.sm,
    borderRadius: radius.inner + 2,
    // Notr: turuncu her satirda olunca hicbir sey one cikmiyordu (gecmis/iptal dahil).
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  dateDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ink, fontVariant: ["tabular-nums"] },
  dateMonth: { color: colors.inkSecondary, fontSize: 12, lineHeight: 16 },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 2, alignSelf: "flex-start", paddingTop: 2 },
  highlight: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
