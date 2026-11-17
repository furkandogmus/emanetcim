import { Children, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Notifications from "expo-notifications";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { ChevronRight, ExternalLink, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ReferralCard } from "@/components/ReferralCard";
import { AppText, Button, IconButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { setAppLanguage } from "@/lib/i18n";
import { SITE_ORIGIN } from "@/lib/images";
import { notify } from "@/lib/notify";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Sistem ayarindan donunce guncellensin diye uygulama one geldikce yeniden okunur. */
function useNotificationPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    const read = () =>
      void Notifications.getPermissionsAsync()
        .then((p) => setGranted(p.granted))
        .catch(() => setGranted(null));
    read();
    const sub = AppState.addEventListener("change", (st) => st === "active" && read());
    return () => sub.remove();
  }, []);
  return granted;
}

function sitePage(path: string, lang: string) {
  return `${SITE_ORIGIN}/${lang === "tr" ? "tr" : "en"}/${path}`;
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { state, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const notifOn = useNotificationPermission();
  if (state.status !== "signedIn") return null;
  const { user } = state;
  const isGuest = user.role === "GUEST";
  const openSite = (path: string) => void Linking.openURL(sitePage(path, i18n.language)).catch(() => undefined);

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

  function chooseLanguage() {
    Alert.alert(t("profile.language"), undefined, [
      { text: "Türkçe", onPress: () => void setAppLanguage("tr") },
      { text: "English", onPress: () => void setAppLanguage("en") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
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

        {/* Kimlik karti duzenleme ekranina gider: ayri bir "Profili duzenle" satiri gerekmez. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profileEdit.open")}
          onPress={() => router.push("/profile-edit")}
          style={({ pressed }) => [styles.identity, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
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
            {user.phone ? (
              <AppText variant="caption">{user.phone}</AppText>
            ) : (
              <AppText variant="caption" style={{ color: colors.accent }}>
                {t("profile.addPhone")}
              </AppText>
            )}
          </View>
          <ChevronRight size={18} color={colors.inkMuted} />
        </Pressable>

        {isGuest ? <ReferralCard audience="guest" /> : null}

        <Section title={t("profile.sections.account")}>
          {isGuest ? (
            <SettingsRow label={t("profile.myBookings")} onPress={() => router.push("/bookings")} />
          ) : null}
          <SettingsRow
            label={t("profile.notifications")}
            value={notifOn == null ? undefined : notifOn ? t("profile.on") : t("profile.off")}
            onPress={() => void Linking.openSettings().catch(() => undefined)}
          />
          <SettingsRow
            label={t("profile.language")}
            value={i18n.language === "tr" ? "Türkçe" : "English"}
            onPress={chooseLanguage}
          />
        </Section>

        <Section title={t("profile.sections.support")}>
          <SettingsRow label={t("profile.faq")} external onPress={() => openSite("faq")} />
          <SettingsRow label={t("profile.contact")} external onPress={() => openSite("contact")} />
          <SettingsRow label={t("profile.terms")} external onPress={() => openSite("terms")} />
          <SettingsRow label={t("profile.privacy")} external onPress={() => openSite("privacy")} />
        </Section>

        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Button variant="secondary" title={t("profile.signOut")} onPress={() => void signOut()} />
          <AppText variant="caption" style={{ textAlign: "center", fontSize: 13 }}>
            {t("profile.signOutNote")}
          </AppText>
        </View>
        {isGuest ? (
          <Button
            variant="ghost"
            textColor={colors.danger}
            title={t("profile.deleteAccount")}
            loading={deleting}
            onPress={confirmDelete}
          />
        ) : (
          <Button variant="ghost" title={t("profile.deleteRequest")} onPress={() => openSite("contact")} />
        )}
        <AppText variant="caption" style={{ textAlign: "center", fontSize: 12 }}>
          {t("profile.version", { version: Constants.expoConfig?.version ?? "" })}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{title}</AppText>
      <View style={styles.group}>
        {items.map((child, i) => (
          <View key={i} style={i > 0 ? styles.linkDivider : undefined}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  external,
  onPress,
}: {
  label: string;
  value?: string;
  external?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={external ? "link" : "button"}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <AppText variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </AppText>
      {value ? <AppText variant="caption">{value}</AppText> : null}
      {external ? (
        <ExternalLink size={16} color={colors.inkMuted} />
      ) : (
        <ChevronRight size={18} color={colors.inkMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 18, color: colors.accent },
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
  const parts = name.normalize("NFC").split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (name.includes("@") ? "" : (parts[1]?.[0] ?? ""))).toLocaleUpperCase("tr-TR") || "?";
}
