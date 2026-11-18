import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Globe } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ChoiceSheet } from "@/components/ChoiceSheet";
import { AppText } from "@/components/ui";
import { setAppLanguage } from "@/lib/i18n";
import { APP_LANGUAGES, isAppLanguage, languageInfo } from "@/lib/languages";
import { colors, radius, space } from "@/theme/tokens";

export const LANGUAGES = APP_LANGUAGES.map(({ value, label }) => ({ value, label }));

/**
 * Giris ekraninin kosesindeki dil dugmesi. Telefon dili Turkce degilse uygulama zaten
 * Ingilizce acilir; bu dugme, Turkce telefon kullanan yabanci ya da tersi icin.
 * Dil adlari her zaman kendi dillerinde yazilir: Turkce bilmeyen "English"i bulabilmeli.
 */
export function LanguageButton({ tone = "light" }: { tone?: "light" | "plain" }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = languageInfo(i18n.language);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("profile.language")}: ${current.label}`}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, tone === "plain" && styles.plain, pressed && { opacity: 0.85 }]}
      >
        <Globe size={16} color={colors.ink} />
        <AppText variant="label" style={{ color: colors.ink }}>
          {current.value.toUpperCase()}
        </AppText>
      </Pressable>
      <ChoiceSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Dil · Language"
        choices={[...LANGUAGES]}
        selected={current.value}
        onSelect={(v) => isAppLanguage(v) && void setAppLanguage(v)}
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
