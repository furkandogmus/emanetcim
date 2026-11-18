import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { LanguageButton } from "@/components/LanguageButton";
import { BrandMark } from "@/components/BrandMark";
import { AppleButton } from "@/components/AppleButton";
import { GoogleButton } from "@/components/GoogleButton";
import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { X } from "lucide-react-native";
import { Input } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { AppleSignInError, appleSignInAvailable } from "@/lib/apple-auth";
import { GoogleSignInError, googleSignInAvailable } from "@/lib/google-auth";
import { colors, fonts, radius, space } from "@/theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { requestCode, verifyCode, signInWithPassword, signInWithGoogle, signInWithApple } = useAuth();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Google akisi ayri: o surerken kod dugmesi donmesin, yalnizca kilitlensin.
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const oauthBusy = googleBusy || appleBusy;
  useEffect(() => {
    let live = true;
    void appleSignInAvailable().then((ok) => live && setAppleAvailable(ok));
    return () => {
      live = false;
    };
  }, []);
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
    setGoogleBusy(true);
    setError(null);
    try {
      // Vazgecilirse null: mesaj yok. Basarida Stack.Protected dogru gruba gecirir.
      if (!(await signInWithGoogle())) setGoogleBusy(false);
    } catch (e) {
      if (e instanceof GoogleSignInError) {
        if (e.code !== "in_progress") setError(t(`auth.errors.${e.code}`));
      } else {
        setError(errorMessage(e, "auth"));
      }
      setGoogleBusy(false);
    }
  }

  async function appleSignIn() {
    setAppleBusy(true);
    setError(null);
    try {
      if (!(await signInWithApple())) setAppleBusy(false);
    } catch (e) {
      setError(e instanceof AppleSignInError ? t("auth.errors.apple_failed") : errorMessage(e, "auth"));
      setAppleBusy(false);
    }
  }

  const emailField = (onSubmit: () => void) => (
    <View style={styles.field}>
      <AppText variant="label" nativeID="emailLabel">
        {t("auth.emailLabel")}
      </AppText>
      <Input
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
      />
    </View>
  );

  const switchTo = (next: "email" | "password") => {
    setStep(next);
    setError(null);
  };

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + space.xl,
          }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Ana sayfadaki sahneyle ayni: giris ekrani da urunun dunyasindan acilir. */}
          <View style={[styles.hero, { height: Math.max(220, height * 0.32) }]}>
            <Image source={require("../../assets/hero.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.scrim} />
            <View style={[styles.heroTop, { marginTop: insets.top + space.md }]}>
              <View style={styles.brandPill}>
                <BrandMark size={20} />
                <AppText variant="bodyMedium" style={{ fontFamily: fonts.displayMedium }}>
                  BagajPark
                </AppText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                {/* Ilk ekranda: Turkce bilmeyen turist girisi kendi dilinde yapabilmeli. */}
                <LanguageButton />
                {/* Girissiz gezerken acildiysa ("Rezervasyon yap", Profil) geri donulebilmeli. */}
                {router.canGoBack() ? (
                  <IconButton label={t("common.cancel")} onPress={() => router.back()}>
                    <X size={20} color={colors.ink} />
                  </IconButton>
                ) : null}
              </View>
            </View>
            <AppText variant="display" style={styles.heroTitle}>
              {t("home.heroTitle")}
            </AppText>
          </View>

          <View style={styles.content}>
            {step === "email" ? (
              <>
                <AppText variant="title">{t("auth.title")}</AppText>
                <AppText variant="caption">{t("auth.subtitle")}</AppText>
                {emailField(sendCode)}
                {error ? <Banner tone="danger" body={error} /> : null}
                <Button title={t("auth.sendCode")} onPress={sendCode} loading={busy} disabled={oauthBusy} />
                <Button
                  variant="ghost"
                  title={t("auth.usePassword")}
                  onPress={() => switchTo("password")}
                  disabled={oauthBusy}
                />
                {googleSignInAvailable || appleAvailable ? (
                  <>
                    <View
                      style={styles.dividerRow}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <View style={styles.dividerLine} />
                      <AppText variant="caption">{t("auth.or")}</AppText>
                      <View style={styles.dividerLine} />
                    </View>
                    {appleAvailable ? (
                      <AppleButton onPress={appleSignIn} loading={appleBusy} disabled={busy || googleBusy} />
                    ) : null}
                    {googleSignInAvailable ? (
                      <GoogleButton
                        title={t("auth.continueWithGoogle")}
                        onPress={googleSignIn}
                        loading={googleBusy}
                        disabled={busy || appleBusy}
                      />
                    ) : null}
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
                  <Input
                    accessibilityLabelledBy="passwordLabel"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={passwordSignIn}
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
                    router.push({
                      pathname: "/reset-password",
                      params: { email: email.trim().toLowerCase() },
                    });
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
                  <Input
                    accessibilityLabelledBy="codeLabel"
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    autoFocus
                    style={styles.codeInput}
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    marginTop: -space.xl,
    padding: space.xl,
    gap: space.lg,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  hero: {
    justifyContent: "space-between",
    backgroundColor: colors.ink,
    paddingHorizontal: space.xl,
  },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(28,25,23,0.42)",
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  heroTitle: {
    color: colors.white,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
    fontSize: 28,
    lineHeight: 32,
    paddingBottom: space.xxl + space.sm,
  },
  field: { gap: space.sm },
  codeInput: {
    fontFamily: fonts.monoMedium,
    fontSize: 26,
    letterSpacing: 10,
    textAlign: "center",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
});
