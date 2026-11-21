import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { PressableProps, StyleProp, TextProps, TextStyle, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";

import { colors, fonts, radius, space } from "@/theme/tokens";

type Variant = "display" | "title" | "heading" | "body" | "bodyMedium" | "caption" | "label" | "mono";

/**
 * Hiyerarsi agirliktan degil boyut ve renkten gelir: hero 800, ekran basligi 700,
 * kart basligi 600. Kucuk metinde negatif harf araligi yok.
 */
const textStyles: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.hero, fontSize: 32, lineHeight: 36, letterSpacing: -0.6, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.3, color: colors.ink },
  heading: { fontFamily: fonts.displayMedium, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 24, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.inkSecondary },
  mono: { fontFamily: fonts.monoMedium, fontSize: 14, lineHeight: 20, color: colors.ink, fontVariant: ["tabular-nums"] },
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
  /** Yalnizca ghost icin: yikici metin eylemi (iptal) kirmizi ama kutusuz durur. */
  textColor?: string;
};

export function Button({ title, variant = "primary", loading, disabled, icon, style, textColor, onPress, ...rest }: ButtonProps) {
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
        pressed && !isDisabled && { opacity: 0.9, transform: [{ scale: 0.985 }] },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.accent} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, { color: textColor ?? palette.fg }]}>{title}</Text>
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
  soft,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Secici (dukkan, filtre): secili hali siyah dolgu yerine yumusak turuncu. */
  soft?: boolean;
}) {
  return (
    <Pressable
      // Yumusak cip 36 px: dokunma alani 44 px olsun.
      hitSlop={soft ? { top: 4, bottom: 4 } : undefined}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        selected && (soft ? { backgroundColor: colors.brandSoft, borderColor: colors.brand } : { backgroundColor: colors.ink, borderColor: colors.ink }),
        soft && { minHeight: 36 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: soft ? colors.accent : colors.white }]}>{label}</Text>
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
    // "brand" bilgi notudur, uyari degil: turuncu yalnizca eylem ve secimde kalsin.
    brand: { bg: colors.surfaceMuted, border: colors.border },
    warning: { bg: colors.warningSoft, border: "#FDE68A" },
    danger: { bg: colors.dangerSoft, border: "#FECACA" },
    success: { bg: colors.successSoft, border: "#BBF7D0" },
  }[tone];
  return (
    // Hata ve uyari bandi ekran okuyucuya duyurulur: giris, odeme ve check-in hatalari
    // aksi halde sessiz kaliyordu. Tehlike aninda keser, digerleri nazikce soyler.
    <View
      accessibilityRole={tone === "danger" ? "alert" : undefined}
      accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
      style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
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
  art,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  /** Bos durumda ikon yerine urunun dunyasindan bir nesne (Illustrations). */
  art?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      {art ? <View style={{ marginBottom: space.sm }}>{art}</View> : null}
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
    minHeight: 52,
    borderRadius: radius.control,
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
    padding: space.xl - space.xs,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.xs },
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
    width: 40,
    height: 40,
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
