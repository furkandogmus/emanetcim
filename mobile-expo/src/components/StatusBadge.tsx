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

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const tone = TONES[status] ?? TONES.PENDING;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{t(`status.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: fonts.bodySemibold, fontSize: 12 },
});
