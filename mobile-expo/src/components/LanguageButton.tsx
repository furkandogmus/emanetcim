import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Globe } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ChoiceSheet } from "@/components/ChoiceSheet";
import { AppText } from "@/components/ui";
import { setAppLanguage } from "@/lib/i18n";
import { colors, radius, space } from "@/theme/tokens";

export const LANGUAGES = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
] as const;

/**
 * Giris ekraninin kosesindeki dil dugmesi. Telefon dili Turkce degilse uygulama zaten
 * Ingilizce acilir; bu dugme, Turkce telefon kullanan yabanci ya da tersi icin.
 * Dil adlari her zaman kendi dillerinde yazilir: Turkce bilmeyen "English"i bulabilmeli.
 */
export function LanguageButton({ tone = "light" }: { tone?: "light" | "plain" }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = i18n.language === "tr" ? "tr" : "en";
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("profile.language")}: ${current === "tr" ? "Türkçe" : "English"}`}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, tone === "plain" && styles.plain, pressed && { opacity: 0.85 }]}
      >
        <Globe size={16} color={colors.ink} />
        <AppText variant="label" style={{ color: colors.ink }}>
          {current.toUpperCase()}
        </AppText>
      </Pressable>
      <ChoiceSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Dil · Language"
        choices={[...LANGUAGES]}
        selected={current}
        onSelect={(v) => void setAppLanguage(v as "tr" | "en")}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  plain: { borderWidth: 1, borderColor: colors.border },
});
