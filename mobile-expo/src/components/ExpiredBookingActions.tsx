import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Banner, Button } from "@/components/ui";
import { isBeforeDropOff, isBookingExpired } from "@/lib/booking-state";
import type { BookingSummary } from "@/lib/types";
import { space } from "@/theme/tokens";

/**
 * Misafirin suresi dolmus rezervasyonu: "Yeniden rezervasyon" birincil, "Rezervasyonu kapat"
 * ikincil. Kapat yalnizca valiz birakilmamissa (sunucu aksi halde invalid_status doner).
 */
export function ExpiredBookingActions({
  booking,
  onRebook,
  onClose,
  closing,
}: {
  booking: Pick<BookingSummary, "status" | "checkOutTime" | "expired">;
  onRebook: () => void;
  onClose: () => void;
  closing: boolean;
}) {
  const { t } = useTranslation();
  if (!isBookingExpired(booking)) return null;
  return (
    <View style={{ gap: space.md }}>
      <Banner tone="warning" title={t("bookings.expiredTitle")} body={t("bookings.expiredBody")} />
      <Button title={t("bookings.rebook")} onPress={onRebook} />
      {isBeforeDropOff(booking.status) ? (
        <Button variant="secondary" title={t("bookings.closeExpired")} loading={closing} onPress={onClose} />
      ) : null}
    </View>
  );
}
