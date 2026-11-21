import { useState } from "react";
import { KeyboardAvoidingView, Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { Input } from "@/components/Field";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { languageInfo } from "@/lib/languages";
import { colors, space } from "@/theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sunucu politikasi: src/lib/auth-password.ts (MIN/MAX_PASSWORD_LENGTH).
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

/*
  E-postadaki sey 6 haneli bir kod DEGIL, web sayfasina giden bir baglanti:
  `/{dil}/auth/new-password?token=<uuid>`. Kullanici ya baglantiyi tarayicida
  acar (orada biter) ya da buraya yapistirir; ikisini de kabul edip token'i
  ayikliyoruz ki "kodu nereden bulacagim" sorusu dogmasin.
*/
function extractResetToken(input: string): string {
  const value = input.trim();
  const match = value.match(/[?&]token=([^&#\s]+)/);
  return match ? decodeURIComponent(match[1]) : value;
}

export default function ResetPasswordScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  // mode=link: kullanicida zaten bir sifre yenileme baglantisi var (yonetici/destek ilettiyse);
  // e-posta adimi atlanir ve dogrudan baglanti + yeni sifre formu acilir.
  const hasLink = params.mode === "link";
  const [step, setStep] = useState<"request" | "confirm" | "done">(hasLink ? "confirm" : "request");
  const [pasteOpen, setPasteOpen] = useState(hasLink);
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [link, setLink] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  async function requestLink() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Sunucu hesap var/yok ayrimini gizlemek icin her zaman { ok: true } doner.
      await api("/auth/password-reset/request", {
        method: "POST",
        // Sunucu tr/en/de bilir; ru baglantisi Ingilizce gider (languageInfo.site).
        body: { email: value, locale: languageInfo(i18n.language).site },
        auth: false,
      });
      setEmail(value);
      setStep("confirm");
    } catch (e) {
      setError(errorMessage(e, "reset"));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    const token = extractResetToken(link);
    if (!token) {
      setError(t("reset.linkRequired"));
      return;
    }
    if (password.trim().length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      setError(t("reset.passwordRule", { min: MIN_PASSWORD }));
      return;
    }
    if (password !== repeat) {
      setError(t("reset.passwordMismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/password-reset/confirm", {
        method: "POST",
        body: { token, password },
        auth: false,
      });
      setPassword("");
      setRepeat("");
      setStep("done");
    } catch (e) {
      setError(errorMessage(e, "reset"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="title" style={{ flex: 1 }}>
              {t("reset.title")}
            </AppText>
            <IconButton label={t("common.close")} onPress={close}>
              <X size={20} color={colors.ink} />
            </IconButton>
          </View>

          {step === "request" ? (
            <>
              <AppText variant="caption">{t("reset.requestSubtitle")}</AppText>
              <View style={styles.field}>
                <AppText variant="label" nativeID="resetEmailLabel">
                  {t("auth.emailLabel")}
                </AppText>
                <Input
                  accessibilityLabelledBy="resetEmailLabel"
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor={colors.inkMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={requestLink}
                />
              </View>
              {error ? <Banner tone="danger" body={error} /> : null}
              <Button title={t("reset.sendLink")} onPress={requestLink} loading={busy} />
            </>
          ) : step === "confirm" ? (
            <>
              {hasLink ? (
                <Banner tone="brand" body={t("reset.linkModeBody")} />
              ) : (
                <>
                  <Banner tone="brand" title={t("reset.sentTitle")} body={t("reset.sentBody", { email })} />
                  <Button title={t("reset.backToSignIn")} onPress={close} />
                  <Button
                    variant="secondary"
                    title={t("reset.openMail")}
                    onPress={() => void Linking.openURL("mailto:").catch(() => undefined)}
                  />
                  {pasteOpen ? null : (
                    <Button variant="ghost" title={t("reset.pasteLink")} onPress={() => setPasteOpen(true)} />
                  )}
                </>
              )}
              {pasteOpen ? (
                <>
                <View style={styles.field}>
                  <AppText variant="label" nativeID="resetLinkLabel">
                    {t("reset.linkLabel")}
                  </AppText>
                  <Input
                    accessibilityLabelledBy="resetLinkLabel"
                    value={link}
                    onChangeText={setLink}
                    placeholder={t("reset.linkPlaceholder")}
                    placeholderTextColor={colors.inkMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.field}>
                  <AppText variant="label" nativeID="resetPasswordLabel">
                    {t("reset.newPasswordLabel")}
                  </AppText>
                  <Input
                    accessibilityLabelledBy="resetPasswordLabel"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    maxLength={MAX_PASSWORD}
                  />
                  <AppText variant="caption">{t("reset.passwordRule", { min: MIN_PASSWORD })}</AppText>
                </View>
                <View style={styles.field}>
                  <AppText variant="label" nativeID="resetRepeatLabel">
                    {t("reset.repeatPasswordLabel")}
                  </AppText>
                  <Input
                    accessibilityLabelledBy="resetRepeatLabel"
                    value={repeat}
                    onChangeText={setRepeat}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    maxLength={MAX_PASSWORD}
                    returnKeyType="go"
                    onSubmitEditing={confirm}
                  />
                </View>
                {error ? <Banner tone="danger" body={error} /> : null}
                <Button
                  title={t("reset.save")}
                  onPress={confirm}
                  loading={busy}
                  disabled={!link.trim() || !password || !repeat}
                />
                </>
              ) : null}
              <Button
                variant="ghost"
                title={t("reset.resendLink")}
                disabled={busy}
                onPress={() => {
                  setError(null);
                  setStep("request");
                }}
              />
            </>
          ) : (
            <>
              <Banner tone="success" title={t("reset.doneTitle")} body={t("reset.doneBody")} />
              <Button title={t("reset.backToSignIn")} onPress={close} />
            </>
          )}
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
});
