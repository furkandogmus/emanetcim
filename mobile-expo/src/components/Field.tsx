import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from "react-native";

import { AppText } from "@/components/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * Uygulamadaki TEK metin kutusu. Her ekran kendi `input` stilini yaziyordu ve
 * yukseklik 48/52/54, yazi 15/16/17 arasinda geziyordu. Yukseklik butonla ayni (52);
 * odakta kenarlik vurgu rengine doner.
 */
export const Input = forwardRef<TextInput, TextInputProps & { style?: StyleProp<TextStyle> }>(function Input(
  { style, onFocus, onBlur, multiline, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.inkMuted}
      multiline={multiline}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, multiline && styles.multiline, focused && styles.focused, style]}
    />
  );
});

/** Etiketli metin kutusu. Etiket ekran okuyucuya da `accessibilityLabel` olarak gider. */
export function Field({
  label,
  hint,
  style,
  inputStyle,
  ...input
}: TextInputProps & { label: string; hint?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={[styles.wrap, style]}>
      <AppText variant="label">{label}</AppText>
      <Input accessibilityLabel={label} {...input} style={inputStyle} />
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  );
}

/** Salt okunur deger (degistirilemeyen e-posta gibi): kutuyla ayni olcu, sonuk zemin. */
export const inputBox = {
  minHeight: 52,
  borderRadius: radius.control,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: space.lg,
} as const;

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    ...inputBox,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: { minHeight: 96, paddingTop: space.md, paddingBottom: space.md, textAlignVertical: "top" },
  focused: { borderColor: colors.accent },
});
