import { StyleSheet, TextInput, View } from "react-native";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";

import { AppText } from "@/components/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Etiketli metin kutusu. Etiket ekran okuyucuya da `accessibilityLabel` olarak gider. */
export function Field({
  label,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.wrap, style]}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
        {...input}
        style={[styles.input, input.multiline && styles.multiline]}
      />
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    minHeight: 54,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
  },
  multiline: { minHeight: 88, paddingTop: space.md, textAlignVertical: "top" },
});
