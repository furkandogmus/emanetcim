import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { LogOut, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button, Card, IconButton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/theme/tokens";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { state, signOut } = useAuth();
  if (state.status !== "signedIn") return null;
  const { user } = state;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <AppText variant="title">{t("profile.title")}</AppText>
        <IconButton label={t("common.close")} onPress={() => router.back()}>
          <X size={20} color={colors.ink} />
        </IconButton>
      </View>

      <Card style={{ gap: space.xs }}>
        <AppText variant="heading">{user.name || user.email}</AppText>
        {user.name && user.email ? <AppText variant="caption">{user.email}</AppText> : null}
        <AppText variant="label" style={{ color: colors.accent, marginTop: space.xs }}>
          {t(`profile.role.${user.role}`)}
        </AppText>
      </Card>

      <View style={{ flex: 1 }} />

      <AppText variant="caption" style={{ textAlign: "center" }}>
        {t("profile.signOutNote")}
      </AppText>
      <Button
        variant="danger"
        title={t("profile.signOut")}
        icon={<LogOut size={18} color={colors.danger} />}
        onPress={() => void signOut()}
      />
      <AppText variant="caption" style={{ textAlign: "center" }}>
        {t("profile.version", { version: Constants.expoConfig?.version ?? "" })}
      </AppText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: space.xl, gap: space.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
