import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { colors, fonts, radius, space } from "@/theme/tokens";

const MAX_NAME = 100;

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
  if (!user) return null;

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="title" style={{ flex: 1 }}>
              {t("profileEdit.title")}
            </AppText>
            <IconButton label={t("common.close")} onPress={close}>
              <X size={20} color={colors.ink} />
            </IconButton>
          </View>

          <View style={styles.field}>
            <AppText variant="label" nativeID="profileNameLabel">
              {t("profileEdit.nameLabel")}
            </AppText>
            <TextInput
              accessibilityLabelledBy="profileNameLabel"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
              maxLength={MAX_NAME}
              returnKeyType="next"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <AppText variant="label" nativeID="profilePhoneLabel">
              {t("profileEdit.phoneLabel")}
            </AppText>
            <TextInput
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
              style={styles.input}
            />
            <AppText variant="caption">{t("profileEdit.phoneHint")}</AppText>
          </View>

          {user.email ? (
            <AppText variant="caption">{t("profileEdit.emailNote", { email: user.email })}</AppText>
          ) : null}

          {error ? <Banner tone="danger" body={error} /> : null}
          <Button title={t("profileEdit.save")} onPress={save} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  field: { gap: space.sm },
  input: {
    minHeight: 54,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
  },
});
