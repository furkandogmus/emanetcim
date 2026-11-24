import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import type { Tone } from "@/lib/admin-system";
import { colors, radius } from "@/theme/tokens";

const TONE: Record<Tone, { fg: string; bg: string }> = {
  ok: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  muted: { fg: colors.inkMuted, bg: colors.surfaceMuted },
};

/** Durum etiketi: nokta + metin. Renk tek basina anlam tasimaz, metin hep yazar. */
export function TonePill({ tone, label }: { tone: Tone; label: string }) {
  const c = TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <AppText variant="caption" style={{ fontSize: 12, color: c.fg }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
