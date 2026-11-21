import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Camera, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/Avatar";
import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { Input, inputBox } from "@/components/Field";
import { ApiError, api, saveTokens } from "@/lib/api";
import { PasswordField } from "@/components/PasswordField";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { prepareAvatar } from "@/lib/shop-photo";
import { colors, space } from "@/theme/tokens";

const MAX_NAME = 100;
// Sunucu politikasi: src/lib/auth-password.ts (MIN/MAX_PASSWORD_LENGTH).
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

/**
 * Sunucudaki `normalizeTrGsm10` (src/lib/netgsm.ts) ile ayni kural; yalnizca
 * istegi bosuna atmamak icin. Son karar sunucunun (`invalid_phone`).
 */
function normalizeTrGsm10(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d.length === 10 && d.startsWith("5") ? d : null;
}

export default function ProfileEditScreen() {
  const { t } = useTranslation();
  const { state, refreshUser } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);
  // Sifresi olan hesap mevcut sifreyi girmeden kaydedemez; baslangic DTO'daki `hasPassword`.
  const [needsCurrent, setNeedsCurrent] = useState(user?.hasPassword ?? false);
  if (!user) return null;

  /** Fotograf formdan bagimsiz, secilir secilmez yuklenir: "Kaydet"i beklemez. */
  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const file = await prepareAvatar(res.assets[0]);
      const form = new FormData();
      form.append("avatar", file as unknown as Blob);
      await api("/auth/me", { method: "PUT", body: form });
      await refreshUser().catch(() => undefined);
    } catch (e) {
      console.warn("avatar_upload_failed", e);
      setError(errorMessage(e, "profileEdit"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setError(null);
    try {
      await api("/auth/me", { method: "PUT", body: { image: null } });
      await refreshUser().catch(() => undefined);
    } catch (e) {
      setError(errorMessage(e, "profileEdit"));
    } finally {
      setPhotoBusy(false);
    }
  }

  function photoMenu() {
    if (!user?.avatarUrl) return void pickPhoto();
    Alert.alert(t("profileEdit.photo"), undefined, [
      { text: t("profileEdit.changePhoto"), onPress: () => void pickPhoto() },
      { text: t("profileEdit.removePhoto"), style: "destructive", onPress: () => void removePhoto() },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  async function savePassword() {
    if (newPassword.trim().length < MIN_PASSWORD || newPassword.length > MAX_PASSWORD) {
      setPasswordError(t("profileEdit.passwordRule", { min: MIN_PASSWORD }));
      return;
    }
    if (newPassword !== repeatPassword) {
      setPasswordError(t("profileEdit.passwordMismatch"));
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordDone(false);
    try {
      const res = await api<{ ok: true; accessToken?: string; refreshToken?: string }>("/auth/me/password", {
        method: "POST",
        body: { newPassword, ...(currentPassword ? { currentPassword } : {}) },
      });
      // Sifre degisince sunucu eski oturumlari dusurur ve bu cihaza yeni token cifti verir.
      if (res.accessToken && res.refreshToken) await saveTokens(res.accessToken, res.refreshToken);
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setNeedsCurrent(true);
      setPasswordDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "current_password_required") setNeedsCurrent(true);
      setPasswordError(errorMessage(e, "profileEdit"));
    } finally {
      setPasswordBusy(false);
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace("/profile"));

  async function save() {
    if (!user) return;
    // Yalnizca degisen alan gider: bos `name` sunucuda `invalid_name`, adi hic
    // olmayan bir kullanicinin yalniz telefonu degistirmesini engellerdi.
    const body: { name?: string; phone?: string | null } = {};
    const trimmedName = name.trim();
    if (trimmedName !== (user.name ?? "")) {
      if (!trimmedName) {
        setError(t("profileEdit.nameRequired"));
        return;
      }
      body.name = trimmedName;
    }
    const trimmedPhone = phone.trim();
    if (trimmedPhone !== (user.phone ?? "")) {
      if (!trimmedPhone) {
        body.phone = null;
      } else {
        const normalized = normalizeTrGsm10(trimmedPhone);
        if (!normalized) {
          setError(t("profileEdit.errors.invalid_phone"));
          return;
        }
        if (normalized !== user.phone) body.phone = normalized;
      }
    }
    if (Object.keys(body).length === 0) {
      close();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api("/auth/me", { method: "PUT", body });
      await refreshUser().catch(() => undefined);
      close();
    } catch (e) {
      setError(errorMessage(e, "profileEdit"));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="title" style={{ flex: 1 }}>
              {t("profileEdit.title")}
            </AppText>
            <IconButton label={t("common.close")} onPress={close}>
              <X size={20} color={colors.ink} />
            </IconButton>
          </View>

          <View style={styles.photoRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={user.avatarUrl ? t("profileEdit.changePhoto") : t("profileEdit.addPhoto")}
              onPress={photoMenu}
              disabled={photoBusy}
            >
              <Avatar name={user.name || user.email || "?"} url={user.avatarUrl} size={88} />
              <View style={styles.photoBadge}>
                {photoBusy ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <Camera size={16} color={colors.ink} />
                )}
              </View>
            </Pressable>
            <Button
              variant="ghost"
              title={user.avatarUrl ? t("profileEdit.changePhoto") : t("profileEdit.addPhoto")}
              onPress={photoMenu}
              disabled={photoBusy}
            />
          </View>

          {user.email ? (
            <View style={styles.field}>
              <AppText variant="label">{t("profileEdit.emailLabel")}</AppText>
              <View style={[inputBox, styles.readOnly]}>
                <AppText variant="body" style={{ color: colors.inkSecondary }} numberOfLines={1}>
                  {user.email}
                </AppText>
              </View>
              <AppText variant="caption">{t("profileEdit.emailLocked")}</AppText>
            </View>
          ) : null}

          <View style={styles.field}>
            <AppText variant="label" nativeID="profileNameLabel">
              {t("profileEdit.nameLabel")}
            </AppText>
            <Input
              accessibilityLabelledBy="profileNameLabel"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
              maxLength={MAX_NAME}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <AppText variant="label" nativeID="profilePhoneLabel">
              {t("profileEdit.phoneLabel")}
            </AppText>
            <Input
              accessibilityLabelledBy="profilePhoneLabel"
              value={phone}
              onChangeText={setPhone}
              placeholder={t("profileEdit.phonePlaceholder")}
              placeholderTextColor={colors.inkMuted}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <AppText variant="caption">{t("profileEdit.phoneHint")}</AppText>
          </View>

          {error ? <Banner tone="danger" body={error} /> : null}
          <Button title={t("profileEdit.save")} onPress={save} loading={busy} />

          <View style={styles.section}>
            <AppText variant="heading">{t("profileEdit.passwordTitle")}</AppText>
            <AppText variant="caption">
              {needsCurrent ? t("profileEdit.passwordChangeHint") : t("profileEdit.passwordSetHint")}
            </AppText>
            {needsCurrent ? (
              <View style={styles.field}>
                <AppText variant="label" nativeID="currentPasswordLabel">
                  {t("profileEdit.currentPasswordLabel")}
                </AppText>
                <PasswordField
                  accessibilityLabelledBy="currentPasswordLabel"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  maxLength={MAX_PASSWORD}
                />
              </View>
            ) : null}
            <View style={styles.field}>
              <AppText variant="label" nativeID="newPasswordLabel">
                {t("profileEdit.newPasswordLabel")}
              </AppText>
              <PasswordField
                accessibilityLabelledBy="newPasswordLabel"
                value={newPassword}
                onChangeText={setNewPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                maxLength={MAX_PASSWORD}
              />
              <AppText variant="caption">{t("profileEdit.passwordRule", { min: MIN_PASSWORD })}</AppText>
            </View>
            <View style={styles.field}>
              <AppText variant="label" nativeID="repeatPasswordLabel">
                {t("profileEdit.repeatPasswordLabel")}
              </AppText>
              <PasswordField
                accessibilityLabelledBy="repeatPasswordLabel"
                value={repeatPassword}
                onChangeText={setRepeatPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                maxLength={MAX_PASSWORD}
                returnKeyType="go"
                onSubmitEditing={savePassword}
              />
            </View>
            {passwordError ? <Banner tone="danger" body={passwordError} /> : null}
            {passwordDone ? <Banner tone="success" body={t("profileEdit.passwordSaved")} /> : null}
            <Button
              variant="secondary"
              title={needsCurrent ? t("profileEdit.changePassword") : t("profileEdit.setPassword")}
              onPress={savePassword}
              loading={passwordBusy}
              disabled={!newPassword || !repeatPassword}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photoRow: { alignItems: "center", gap: space.xs },
  photoBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  field: { gap: space.sm },
  section: { gap: space.md, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  readOnly: { justifyContent: "center", backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
});
