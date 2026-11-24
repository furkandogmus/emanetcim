import { Children } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme/tokens";
import { flipInRtl } from "@/lib/rtl";

/** Ayar satirlarini tek kartta, ince ayiricilarla toplar (profildeki "Hesap" grubuyla ayni). */
export function LinkGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.group}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={i > 0 ? styles.divider : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Bir alt ekrana giden satir. Ikon notr: satirlar turuncu dairelerle yarismasin. */
export function LinkRow({ icon, label, onPress }: { icon?: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <AppText variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </AppText>
      <ChevronRight size={18} color={colors.inkMuted} style={flipInRtl} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg },
  icon: { width: 20, alignItems: "center" },
});
