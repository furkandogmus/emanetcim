import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { GoogleButton } from "@/components/GoogleButton";
import { AppText, Banner, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { GoogleSignInError, googleSignInAvailable } from "@/lib/google-auth";
import { colors, fonts, radius, space } from "@/theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { requestCode, verifyCode, signInWithPassword, signInWithGoogle } = useAuth();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestCode(value);
      setEmail(value);
      setCode("");
      setStep("code");
    } catch (e) {
      setError(errorMessage(e, "auth"));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      // Basarili olursa Stack.Protected kendiliginden dogru gruba gecirir.
      await verifyCode(email, code);
    } catch (e) {
      setError(errorMessage(e, "auth"));
      setBusy(false);
    }
  }

  async function passwordSignIn() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(value, password);
    } catch (e) {
      setError(errorMessage(e, "auth"));
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setError(null);
    try {
      // Vazgecilirse null: mesaj yok. Basarida Stack.Protected dogru gruba gecirir.
      if (!(await signInWithGoogle())) setBusy(false);
    } catch (e) {
      if (e instanceof GoogleSignInError) {
        if (e.code !== "in_progress") setError(t(`auth.errors.${e.code}`));
      } else {
        setError(errorMessage(e, "auth"));
      }
      setBusy(false);
    }
  }

  const emailField = (onSubmit: () => void) => (
    <View style={styles.field}>
      <AppText variant="label" nativeID="emailLabel">
        {t("auth.emailLabel")}
      </AppText>
      <TextInput
        accessibilityLabelledBy="emailLabel"
        value={email}
        onChangeText={setEmail}
        placeholder={t("auth.emailPlaceholder")}
        placeholderTextColor={colors.inkMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        returnKeyType={step === "password" ? "next" : "send"}
        onSubmitEditing={onSubmit}
        style={styles.input}
      />
    </View>
  );

  const switchTo = (next: "email" | "password") => {
    setStep(next);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logoDot} />
            <AppText variant="heading" style={{ color: colors.accent }}>
              BagajPark
            </AppText>
          </View>

          {step === "email" ? (
            <>
              <AppText variant="title">{t("auth.title")}</AppText>
              <AppText variant="caption">{t("auth.subtitle")}</AppText>
              {emailField(sendCode)}
              {error ? <Banner tone="danger" body={error} /> : null}
              <Button title={t("auth.sendCode")} onPress={sendCode} loading={busy} />
              <Button variant="ghost" title={t("auth.usePassword")} onPress={() => switchTo("password")} />
              {googleSignInAvailable ? (
                <>
                  <View style={styles.dividerRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <View style={styles.dividerLine} />
                    <AppText variant="caption">{t("auth.or")}</AppText>
                    <View style={styles.dividerLine} />
                  </View>
                  <GoogleButton title={t("auth.continueWithGoogle")} onPress={googleSignIn} loading={busy} />
                </>
              ) : null}
            </>
          ) : step === "password" ? (
            <>
              <AppText variant="title">{t("auth.title")}</AppText>
              <AppText variant="caption">{t("auth.passwordSubtitle")}</AppText>
              {emailField(() => undefined)}
              <View style={styles.field}>
                <AppText variant="label" nativeID="passwordLabel">
                  {t("auth.passwordLabel")}
                </AppText>
                <TextInput
                  accessibilityLabelledBy="passwordLabel"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={passwordSignIn}
                  style={styles.input}
                />
              </View>
              {error ? <Banner tone="danger" body={error} /> : null}
              <Button
                title={t("auth.verify")}
                onPress={passwordSignIn}
                loading={busy}
                disabled={password.length === 0}
              />
              <Button
                variant="ghost"
                title={t("reset.forgotPassword")}
                onPress={() => {
                  setError(null);
                  router.push({ pathname: "/reset-password", params: { email: email.trim().toLowerCase() } });
                }}
              />
              <Button variant="ghost" title={t("auth.useCode")} onPress={() => switchTo("email")} />
            </>
          ) : (
            <>
              <AppText variant="title">{t("auth.codeTitle")}</AppText>
              <AppText variant="caption">{t("auth.codeSubtitle", { email })}</AppText>
              <View style={styles.field}>
                <AppText variant="label" nativeID="codeLabel">
                  {t("auth.codeLabel")}
                </AppText>
                <TextInput
                  accessibilityLabelledBy="codeLabel"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  style={[styles.input, styles.codeInput]}
                />
              </View>
              {error ? <Banner tone="danger" body={error} /> : null}
              <Button title={t("auth.verify")} onPress={verify} loading={busy} disabled={code.length !== 6} />
              <View style={styles.row}>
                <Button variant="ghost" title={t("auth.resend")} onPress={sendCode} disabled={busy} />
                <Button
                  variant="ghost"
                  title={t("auth.changeEmail")}
                  onPress={() => {
                    setStep("email");
                    setError(null);
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg, paddingTop: space.xxl },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xl },
  logoDot: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.brand },
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
  codeInput: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 10, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
});
