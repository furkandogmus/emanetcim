import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Minus, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export type BagSize = "s" | "m" | "xl";

const IMAGES = {
  s: require("../../assets/bags/s.webp"),
  m: require("../../assets/bags/m.webp"),
  xl: require("../../assets/bags/xl.webp"),
};

const MAX_PER_SIZE = 20;

/** Bounce'taki gibi gercek valiz gorseli + buyuk +/- dugmeleri. */
export function BagCounter({
  size,
  value,
  onChange,
}: {
  size: BagSize;
  value: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation();
  const name = t(`bags.${size}`);
  return (
    <View style={[styles.card, value > 0 && styles.cardActive]}>
      <View style={styles.imageBox}>
        <Image source={IMAGES[size]} style={styles.image} contentFit="contain" />
      </View>
      <View style={styles.body}>
        <AppText variant="heading">{name}</AppText>
        <AppText variant="caption">{t(`bags.${size}Desc`)}</AppText>
        <View style={styles.stepper}>
          <StepButton
            label={t("bags.decrease", { size: name })}
            disabled={value === 0}
            onPress={() => onChange(value - 1)}
          >
            <Minus size={20} color={value === 0 ? colors.borderStrong : colors.ink} />
          </StepButton>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {value}
          </Text>
          <StepButton
            label={t("bags.increase", { size: name })}
            disabled={value >= MAX_PER_SIZE}
            onPress={() => onChange(value + 1)}
          >
            <Plus size={20} color={colors.ink} />
          </StepButton>
        </View>
      </View>
    </View>
  );
}

function StepButton({
  children,
  label,
  disabled,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.step,
        disabled && { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
        pressed && { opacity: 0.7 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.md,
  },
  cardActive: { borderColor: colors.brand },
  imageBox: {
    width: 104,
    borderRadius: radius.control,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    padding: space.sm,
  },
  image: { width: 84, height: 96 },
  body: { flex: 1, gap: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.sm },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, minWidth: 24, textAlign: "center" },
});
