import { Linking, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { LuggageTag } from "@/components/Illustrations";
import { LanguageButton } from "@/components/LanguageButton";
import { AppText, Button } from "@/components/ui";
import { SITE_ORIGIN } from "@/lib/images";
import { languageInfo } from "@/lib/languages";
import { colors, space } from "@/theme/tokens";

/** Giris yapmadan gezen misafire: rezervasyonlar ve profil icin giris istegi. */
export function SignInPrompt({ title, body }: { title: string; body: string }) {
  const { t, i18n } = useTranslation();
  const openSite = (path: string) =>
    void Linking.openURL(`${SITE_ORIGIN}/${languageInfo(i18n.language).site}/${path}`).catch(() => undefined);
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <LanguageButton tone="plain" />
      </View>
      <View style={styles.center}>
        <LuggageTag size={96} />
        <AppText variant="title" style={{ textAlign: "center" }}>
          {title}
        </AppText>
        <AppText variant="body" style={{ textAlign: "center", color: colors.inkSecondary }}>
          {body}
        </AppText>
        <Button title={t("auth.signInCta")} onPress={() => router.push("/login")} style={{ alignSelf: "stretch" }} />
        {/* Giris ekrani da ayni cumleyi gosterir; burada, hesap acilmadan once okunabilsin. */}
        <AppText variant="caption" style={styles.legal}>
          {t("auth.legalPrefix")}
          <AppText variant="caption" accessibilityRole="link" style={styles.legalLink} onPress={() => openSite("terms")}>
            {t("auth.legalTerms")}
          </AppText>
          {t("auth.legalAnd")}
          <AppText variant="caption" accessibilityRole="link" style={styles.legalLink} onPress={() => openSite("privacy")}>
            {t("auth.legalPrivacy")}
          </AppText>
          {t("auth.legalSuffix")}
          {t("auth.legalKvkkPrefix")}
          <AppText variant="caption" accessibilityRole="link" style={styles.legalLink} onPress={() => openSite("kvkk")}>
            {t("auth.legalKvkk")}
          </AppText>
          {t("auth.legalKvkkSuffix")}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: "row", justifyContent: "flex-end", padding: space.xl },
  legal: { textAlign: "center", color: colors.inkSecondary },
  legalLink: { textDecorationLine: "underline", color: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
});
