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

/** Gercek valiz gorseli + tek parca sayac (eksi | sayi | arti). */
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
      <View style={[styles.imageBox, value > 0 && { backgroundColor: colors.brandSoft }]}>
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
            <Minus size={18} color={value === 0 ? colors.borderStrong : colors.ink} />
          </StepButton>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {value}
          </Text>
          <StepButton
            label={t("bags.increase", { size: name })}
            disabled={value >= MAX_PER_SIZE}
            onPress={() => onChange(value + 1)}
          >
            <Plus size={18} color={colors.ink} />
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
        disabled && { opacity: 0.6 },
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
    width: 96,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    padding: space.sm,
  },
  image: { width: 76, height: 88 },
  body: { flex: 1, gap: 2, justifyContent: "center" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  step: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    minWidth: 40,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    lineHeight: 40,
  },
});
