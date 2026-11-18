import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { Sheet } from "@/components/Sheet";
import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme/tokens";

export type Choice = { value: string; label: string; detail?: string };

/** Tek secimlik liste paneli (dil, dukkan): secili satirda onay isareti, dokununca kapanir. */
export function ChoiceSheet({
  visible,
  onClose,
  title,
  choices,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  choices: Choice[];
  selected: string | null | undefined;
  onSelect: (value: string) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="heading">{title}</AppText>
      <View style={styles.group}>
        {choices.map((c, i) => {
          const on = c.value === selected;
          return (
            <Pressable
              key={c.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                onClose();
                if (!on) onSelect(c.value);
              }}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.divider,
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium" style={on ? { color: colors.accent } : undefined}>
                  {c.label}
                </AppText>
                {c.detail ? <AppText variant="caption">{c.detail}</AppText> : null}
              </View>
              {on ? <Check size={20} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
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
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
