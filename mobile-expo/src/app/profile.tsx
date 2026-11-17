import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { ChevronRight, ExternalLink, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ReferralCard } from "@/components/ReferralCard";
import { AppText, Button, Card, IconButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SITE_ORIGIN } from "@/lib/images";
import { notify } from "@/lib/notify";
import { colors, fonts, radius, space } from "@/theme/tokens";

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
      notify(
        t("profile.deleteFailedTitle"),
        activeBookings ? t("profile.deleteActiveBookings") : t("common.genericError"),
      );
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Davet karti eklenince icerik kucuk ekrana sigmiyor; flexGrow ile alt dugmeler yine dipte. */}
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">{t("profile.title")}</AppText>
        <IconButton
          label={t("common.close")}
          // Deep link ya da yeniden yuklemeyle tek ekran kalinca `back` hicbir sey yapmiyordu.
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          <X size={20} color={colors.ink} />
        </IconButton>
      </View>

      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <AppText style={styles.avatarText}>{initials(user.name || user.email || "?")}</AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={1}>
            {user.name || user.email}
          </AppText>
          {user.name && user.email ? (
            <AppText variant="caption" numberOfLines={1}>
              {user.email}
            </AppText>
          ) : null}
          {user.phone ? <AppText variant="caption">{user.phone}</AppText> : null}
        </View>
        <View style={styles.rolePill}>
          <AppText variant="label" style={{ fontSize: 12 }}>
            {t(`profile.role.${user.role}`)}
          </AppText>
        </View>
      </Card>

      {isGuest ? <ReferralCard audience="guest" /> : null}

      <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/profile-edit")}
        style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <AppText variant="bodyMedium" style={{ flex: 1 }}>
          {t("profileEdit.open")}
        </AppText>
        <ChevronRight size={18} color={colors.inkMuted} />
      </Pressable>

      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(sitePage("privacy", i18n.language)).catch(() => undefined)}
        style={({ pressed }) => [styles.linkRow, styles.linkDivider, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <AppText variant="bodyMedium" style={{ flex: 1 }}>
          {t("profile.privacy")}
        </AppText>
        <ExternalLink size={16} color={colors.inkMuted} />
      </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      <AppText variant="caption" style={{ textAlign: "center" }}>
        {t("profile.signOutNote")}
      </AppText>
      <Button
        variant="secondary"
        title={t("profile.signOut")}
        onPress={() => void signOut()}
      />
      {isGuest ? (
        <Button
          variant="ghost"
          textColor={colors.danger}
          title={t("profile.deleteAccount")}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: space.xl, gap: space.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 18, color: colors.accent },
  rolePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  group: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  linkRow: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: space.lg },
  linkDivider: { borderTopWidth: 1, borderTopColor: colors.border },
});

/** "Test Misafir" -> "TM"; e-postada ilk harf. */
function initials(name: string) {
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (name.includes("@") ? "" : (parts[1]?.[0] ?? ""))).toLocaleUpperCase("tr-TR") || "?";
}
