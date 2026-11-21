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
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { normalizeTrGsm10 } from "@/lib/phone";
import { prepareAvatar } from "@/lib/shop-photo";
import { colors, space } from "@/theme/tokens";

const MAX_NAME = 100;

export default function ProfileEditScreen() {
  const { t } = useTranslation();
  const { state, refreshUser } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
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

  const close = () => (router.canGoBack() ? router.back() : router.replace("/profile"));

  function save() {
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

    // Telefon ayni zamanda giris numarasi: kayitli numarayi silmek ya da degistirmek onayla.
    if (body.phone !== undefined && user.phone) {
      const clearing = body.phone === null;
      Alert.alert(
        t(clearing ? "profileEdit.phoneClearTitle" : "profileEdit.phoneChangeTitle"),
        t(clearing ? "profileEdit.phoneClearBody" : "profileEdit.phoneChangeBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.continue"), style: clearing ? "destructive" : "default", onPress: () => void send(body) },
        ],
      );
      return;
    }
    void send(body);
  }

  async function send(body: { name?: string; phone?: string | null }) {
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
  readOnly: { justifyContent: "center", backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
});
