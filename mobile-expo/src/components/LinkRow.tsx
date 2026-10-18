import { Pressable, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme/tokens";

/** Ayar listelerinde bir alt ekrana giden satir. */
export function LinkRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.icon}>{icon}</View>
      <AppText variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </AppText>
      <ChevronRight size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
