import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { ExternalLink, LogOut, Trash2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button, Card, IconButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SITE_ORIGIN } from "@/lib/images";
import { colors, space } from "@/theme/tokens";

function sitePage(path: string, lang: string) {
  return `${SITE_ORIGIN}/${lang === "tr" ? "tr" : "en"}/${path}`;
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { state, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  if (state.status !== "signedIn") return null;
  const { user } = state;
  const isGuest = user.role === "GUEST";

  /*
    Google Play: hesap olusturan uygulama, hesap silmeyi UYGULAMA ICINDEN
    sunmak zorunda. Sunucu hesabi silmez, anonimlestirir (KVKK;
    `AccountPrivacyService.anonymizeSelf`). Esnaf ve yonetici kendini
    silemez (403) -- onlar icin silme talebi iletisim sayfasindan baslar.
  */
  function confirmDelete() {
    Alert.alert(t("profile.deleteTitle"), t("profile.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.deleteConfirm"), style: "destructive", onPress: () => void deleteAccount() },
    ]);
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api("/account/delete", { method: "DELETE" });
      await signOut();
    } catch (e) {
      const activeBookings = e instanceof ApiError && e.status === 400;
      Alert.alert(
        t("profile.deleteFailedTitle"),
        activeBookings ? t("profile.deleteActiveBookings") : t("common.genericError"),
      );
      setDeleting(false);
    }
  }

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

      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(sitePage("privacy", i18n.language)).catch(() => undefined)}
        style={styles.linkRow}
      >
        <AppText variant="bodyMedium" style={{ flex: 1 }}>
          {t("profile.privacy")}
        </AppText>
        <ExternalLink size={18} color={colors.inkMuted} />
      </Pressable>

      <View style={{ flex: 1 }} />

      <AppText variant="caption" style={{ textAlign: "center" }}>
        {t("profile.signOutNote")}
      </AppText>
      <Button
        variant="secondary"
        title={t("profile.signOut")}
        icon={<LogOut size={18} color={colors.ink} />}
        onPress={() => void signOut()}
      />
      {isGuest ? (
        <Button
          variant="danger"
          title={t("profile.deleteAccount")}
          icon={<Trash2 size={18} color={colors.danger} />}
          loading={deleting}
          onPress={confirmDelete}
        />
      ) : (
        <Button
          variant="ghost"
          title={t("profile.deleteRequest")}
          onPress={() => void Linking.openURL(sitePage("contact", i18n.language)).catch(() => undefined)}
        />
      )}
      <AppText variant="caption" style={{ textAlign: "center" }}>
        {t("profile.version", { version: Constants.expoConfig?.version ?? "" })}
      </AppText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: space.xl, gap: space.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
