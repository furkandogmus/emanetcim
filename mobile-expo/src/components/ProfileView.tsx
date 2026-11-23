import { Children, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { formatPhone } from "@/lib/phone";
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Notifications from "expo-notifications";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { ChevronRight, ExternalLink, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/Avatar";
import { ChoiceSheet } from "@/components/ChoiceSheet";
import { LANGUAGES } from "@/components/LanguageButton";
import { isAppLanguage, languageInfo } from "@/lib/languages";
import { ReferralCard } from "@/components/ReferralCard";
import { AppText, Button, IconButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { useMyDeletionRequest, useRequestAccountDeletion } from "@/lib/queries";
import { setAppLanguage } from "@/lib/i18n";
import { SITE_ORIGIN } from "@/lib/images";
import { notify } from "@/lib/notify";
import { colors, radius, space } from "@/theme/tokens";

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
  return `${SITE_ORIGIN}/${languageInfo(lang).site}/${path}`;
}

/**
 * Profil icerigi. Rol sekmelerinde (misafir, esnaf) sekme olarak, yoneticide ve
 * derin baglantida `/profile` modali olarak acilir; `asTab` kapat dugmesini gizler.
 */
export function ProfileView({ asTab = false, embedded = false }: { asTab?: boolean; embedded?: boolean }) {
  const { t, i18n } = useTranslation();
  const { state, signOut, impersonating } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notifOn = useNotificationPermission();
  const [langOpen, setLangOpen] = useState(false);
  const signedInRole = state.status === "signedIn" ? state.user.role : null;
  const deletionQuery = useMyDeletionRequest(signedInRole !== null && signedInRole !== "GUEST" && !impersonating);
  const requestDeletion = useRequestAccountDeletion();
  if (state.status !== "signedIn") return null;
  const { user } = state;
  const isGuest = user.role === "GUEST";
  const deletionDue = deletionQuery.data?.status === "PENDING" ? deletionQuery.data.dueAt : null;
  const openSite = (path: string) => void Linking.openURL(sitePage(path, i18n.language)).catch(() => undefined);

  /*
    Google Play ve App Store 5.1.1(v): hesap silme UYGULAMA ICINDEN. Misafir
    aninda anonimlestirir (`anonymizeSelf`); esnaf/yonetici talep birakir,
    yonetici aktif rezervasyon ve hakedis bitince tamamlar (`requestDeletion`).
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

  function confirmDeletionRequest() {
    Alert.alert(t("profile.requestTitle"), t("profile.requestBody", { days: deletionQuery.data?.slaDays ?? 30 }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.requestConfirm"),
        style: "destructive",
        onPress: () =>
          requestDeletion.mutate(
            { locale: i18n.language },
            {
              onSuccess: (r) =>
                notify(t("profile.requestReceivedTitle"), t("profile.requestReceivedBody", { days: r.slaDays })),
              onError: (e) => notify(t("profile.deleteFailedTitle"), errorMessage(e, "profile")),
            },
          ),
      },
    ]);
  }

  const sections = (
    <>
      {/* Kimlik karti duzenleme ekranina gider: ayri bir "Profili duzenle" satiri gerekmez. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("profileEdit.open")}
        onPress={() => router.push("/profile-edit")}
        style={({ pressed }) => [styles.identity, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <Avatar name={user.name || user.email || "?"} url={user.avatarUrl} size={52} />
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
            <AppText variant="caption">{formatPhone(user.phone)}</AppText>
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
        <SettingsRow
          label={t("profile.notifications")}
          value={notifOn == null ? undefined : notifOn ? t("profile.on") : t("profile.off")}
          onPress={() => void Linking.openSettings().catch(() => undefined)}
        />
        <SettingsRow
          label={t("profile.language")}
          value={languageInfo(i18n.language).label}
          onPress={() => setLangOpen(true)}
        />
      </Section>

      <Section title={t("profile.sections.support")}>
        <SettingsRow label={t("profile.faq")} external onPress={() => openSite("faq")} />
        <SettingsRow label={t("profile.contact")} external onPress={() => openSite("contact")} />
        <SettingsRow label={t("profile.terms")} external onPress={() => openSite("terms")} />
        <SettingsRow label={t("profile.privacy")} external onPress={() => openSite("privacy")} />
        <SettingsRow label={t("profile.kvkk")} external onPress={() => openSite("kvkk")} />
      </Section>

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Button
          variant="secondary"
          title={t("profile.signOut")}
          // Cikis iki ag cagrisi bekler (bildirim kaydi + oturum iptali); zayif agda geri
          // bildirim yoksa kullanici tekrar tekrar basiyordu.
          loading={signingOut}
          onPress={() => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          }}
        />
        <AppText variant="caption" style={{ textAlign: "center", fontSize: 13 }}>
          {t("profile.signOutNote")}
        </AppText>
      </View>
      {/* Yonetici goruntulemesinde hesap silme sunulmaz (sunucu da 403 doner). */}
      {impersonating ? null : isGuest ? (
        <Button
          variant="ghost"
          textColor={colors.danger}
          title={t("profile.deleteAccount")}
          loading={deleting}
          onPress={confirmDelete}
        />
      ) : deletionDue ? (
        <AppText variant="caption" style={{ textAlign: "center", color: colors.danger }} accessibilityRole="text">
          {t("profile.requestPending", { date: formatDay(deletionDue) })}
        </AppText>
      ) : (
        <Button
          variant="ghost"
          textColor={colors.danger}
          title={t("profile.deleteAccount")}
          loading={requestDeletion.isPending}
          disabled={deletionQuery.isLoading}
          onPress={confirmDeletionRequest}
        />
      )}
      <AppText variant="caption" style={{ textAlign: "center", fontSize: 12 }}>
        {t("profile.version", { version: Constants.expoConfig?.version ?? "" })}
      </AppText>
    </>
  );

  return (
    <>
      {/* Dukkanim'a gomulu: baslik ve kaydirma o ekranin; burada yalnizca bolumler. */}
      {embedded ? (
        <View style={{ gap: space.xl }}>{sections}</View>
      ) : (
        <SafeAreaView style={styles.safe} edges={asTab ? ["top"] : undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <AppText variant="title">{t("profile.title")}</AppText>
              {asTab ? null : (
                <IconButton
                  label={t("common.close")}
                  // Deep link ya da yeniden yuklemeyle tek ekran kalinca `back` hicbir sey yapmiyordu.
                  onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                >
                  <X size={20} color={colors.ink} />
                </IconButton>
              )}
            </View>

            {sections}
          </ScrollView>
        </SafeAreaView>
      )}
      <ChoiceSheet
        visible={langOpen}
        onClose={() => setLangOpen(false)}
        title="Dil · Language"
        choices={[...LANGUAGES]}
        selected={languageInfo(i18n.language).value}
        onSelect={(v) => isAppLanguage(v) && void setAppLanguage(v)}
      />
    </>
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
