import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { BookingStatus } from "@/lib/types";
import { colors, fonts, radius } from "@/theme/tokens";

const TONES: Record<BookingStatus, { bg: string; fg: string }> = {
  APPROVED: { bg: colors.successSoft, fg: colors.success },
  PAID: { bg: colors.successSoft, fg: colors.success },
  CHECKED_IN: { bg: colors.brandSoft, fg: colors.accent },
  CHECKED_OUT: { bg: colors.surfaceMuted, fg: colors.inkSecondary },
  CANCELLED: { bg: colors.dangerSoft, fg: colors.danger },
  PENDING: { bg: colors.warningSoft, fg: colors.warning },
  WAITING_APPROVAL: { bg: colors.warningSoft, fg: colors.warning },
};

const NEVER_DROPPED = new Set<BookingStatus>(["APPROVED", "PAID", "PENDING", "WAITING_APPROVAL"]);

/**
 * `checkOutTime` verilirse: valiz hic birakilmadan bitis saati gecmis rezervasyon
 * "Kullanilmadi" yazar. Durum sunucuda bilerek degismiyor (sure asimi taramasi
 * yalnizca isaretler), ama gecmis sekmesinde yesil "Onaylandi" hala gecerli bir
 * rezervasyon gibi okunuyordu.
 */
export function StatusBadge({
  status,
  checkOutTime,
  partnerView,
}: {
  status: BookingStatus;
  checkOutTime?: string;
  /** Esnafa "Onaylandi" degil "Bekleniyor": o onay esnafin isi degil, misafir henuz gelmedi. */
  partnerView?: boolean;
}) {
  const { t } = useTranslation();
  // BookingRow ile ayni desen: an bir kez okunur, cizim saf kalir.
  const [now] = useState(() => Date.now());
  const unused = !!checkOutTime && NEVER_DROPPED.has(status) && new Date(checkOutTime).getTime() < now;
  const tone = unused ? TONES.CHECKED_OUT : (TONES[status] ?? TONES.PENDING);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{unused ? t("status.UNUSED") : partnerView && (status === "APPROVED" || status === "PAID") ? t("partner.statusWaiting") : t(`status.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: fonts.bodySemibold, fontSize: 12 },
});
