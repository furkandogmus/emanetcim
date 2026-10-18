import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { PressableProps, StyleProp, TextProps, TextStyle, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";

import { colors, fonts, radius, space } from "@/theme/tokens";

type Variant = "display" | "title" | "heading" | "body" | "bodyMedium" | "caption" | "label";

const textStyles: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.7, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.5, color: colors.ink },
  heading: { fontFamily: fonts.displayMedium, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 23, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18, color: colors.inkSecondary },
};

export function AppText({
  variant = "body",
  style,
  ...rest
}: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[textStyles[variant], style]} />;
}

type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = "primary", loading, disabled, icon, style, onPress, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.accent, fg: colors.white, border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.border },
    ghost: { bg: "transparent", fg: colors.accent, border: "transparent" },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.border },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      // Yuklenirken icerik yalnizca spinner; etiket olmasa ekran okuyucu "busy" der.
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        isDisabled && variant === "primary" && { backgroundColor: colors.borderStrong, borderColor: colors.borderStrong },
        pressed && !isDisabled && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.accent} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: colors.ink, borderColor: colors.ink },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  children,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Banner({
  tone = "brand",
  title,
  body,
}: {
  tone?: "brand" | "warning" | "danger" | "success";
  title?: string;
  body: string;
}) {
  const palette = {
    brand: { bg: colors.brandSoft, border: colors.brandSoftBorder },
    warning: { bg: colors.warningSoft, border: "#FDE68A" },
    danger: { bg: colors.dangerSoft, border: "#FECACA" },
    success: { bg: colors.successSoft, border: "#BBF7D0" },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {title ? <AppText variant="bodyMedium">{title}</AppText> : null}
      <AppText variant="caption" style={{ color: colors.inkSecondary }}>
        {body}
      </AppText>
    </View>
  );
}

export function CenterMessage({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <AppText variant="heading" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="caption" style={{ textAlign: "center" }}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: space.sm },
  buttonText: { fontFamily: fonts.bodySemibold, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.md },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    borderRadius: radius.control,
    borderWidth: 1,
    padding: space.lg,
    gap: space.xs,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
    gap: space.md,
  },
});
