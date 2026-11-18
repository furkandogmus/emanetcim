import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { LuggageTag } from "@/components/Illustrations";
import { LanguageButton } from "@/components/LanguageButton";
import { AppText, Button } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

/** Giris yapmadan gezen misafire: rezervasyonlar ve profil icin giris istegi. */
export function SignInPrompt({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation();
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: "row", justifyContent: "flex-end", padding: space.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
});
