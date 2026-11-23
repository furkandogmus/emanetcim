import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import type { TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { LanguageButton } from "@/components/LanguageButton";
import { BrandMark } from "@/components/BrandMark";
import { AppleButton } from "@/components/AppleButton";
import { GoogleButton } from "@/components/GoogleButton";
import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { X } from "lucide-react-native";
import { Input } from "@/components/Field";
import { PasswordField } from "@/components/PasswordField";
import { Segmented } from "@/components/Segmented";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { AppleSignInError, appleSignInAvailable } from "@/lib/apple-auth";
import { GoogleSignInError, googleSignInAvailable } from "@/lib/google-auth";
import { SITE_ORIGIN } from "@/lib/images";
import {
  applyIdentityInput,
  identityLabel,
  parseIdentity,
  parsePhone,
  switchIdentityMode,
} from "@/lib/identity";
import { languageInfo } from "@/lib/languages";
import { colors, fonts, radius, space } from "@/theme/tokens";

type Mode = "email" | "phone";
/** Yeni kod istendikten sonra tekrar istemeden beklenen sure (sunucu 2 dakikada 3 koda izin veriyor). */
const RESEND_COOLDOWN_S = 40;

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { requestCode, verifyCode, signInWithPassword, signInWithGoogle, signInWithApple } = useAuth();
  // E-posta modunda kod + sifre var; telefon modunda yalnizca sifre (SMS yok).
  // Oturumu biten esnaf buraya kimligi dolu gelir (`identity`); kendi numarasini yeniden yazmaz.
  const { identity: prefill } = useLocalSearchParams<{ identity?: string }>();
  const [initial] = useState(() =>
    applyIdentityInput({ mode: "email", email: "", phone: "" }, typeof prefill === "string" ? prefill : "", false),
  );
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const passwordRef = useRef<TextInput>(null);
  const modeLockedRef = useRef(false);
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
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  const [error, setError] = useState<string | null>(null);

  const openSite = (path: string) =>
    void Linking.openURL(`${SITE_ORIGIN}/${languageInfo(i18n.language).site}/${path}`).catch(() => undefined);

  function authError(e: unknown) {
    // Telefon girisinde "e-posta ya da sifre" demek yaniltir; hesap var/yok bilgisi yine sizmaz.
    if (e instanceof ApiError && e.code === "invalid_credentials" && mode === "phone") {
      return t("auth.errors.invalid_credentials_phone");
    }
    return errorMessage(e, "auth");
  }

  function changeMode(next: Mode) {
    // Sekmeye dokunmak son sozdur: otomatik telefon gecisi bir daha devreye girmez.
    modeLockedRef.current = true;
    const s = switchIdentityMode({ mode, email, phone }, next);
    setMode(s.mode);
    setEmail(s.email);
    setPhone(s.phone);
    setStep("email");
    setError(null);
    setNotice(null);
  }

  /*
    Tek metin kutusu iki modda da AYNI yerde durur (kutu yeniden kurulmaz, klavye
    kapanmaz). Kullanici sekmeye dokunmadikca e-posta modunda telefon gibi bir sey
    yazilirsa telefon moduna gecilir; telefon kutusuna harf/@ girilirse e-postaya
    doner. Sekmeye dokunulduktan sonra otomatik gecis kapanir: "1907x@..." gibi
    rakamla baslayan e-posta phone-pad klavyede yazilamaz (kural `applyIdentityInput`).
  */
  function onIdentityChange(v: string) {
    setError(null);
    if (mode === "email" && step === "code") {
      setEmail(v);
      return;
    }
    const s = applyIdentityInput({ mode, email, phone }, v, modeLockedRef.current);
    if (s.mode !== mode) setStep("email");
    setMode(s.mode);
    setEmail(s.email);
    setPhone(s.phone);
  }

  async function sendCode(resend = false) {
    const id = parseIdentity(email);
    if (!id || !("email" in id)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestCode(id);
      setEmail(identityLabel(id));
      setCode("");
      setNotice(resend ? t("auth.codeSentAgain") : null);
      setCooldown(RESEND_COOLDOWN_S);
      setStep("code");
    } catch (e) {
      setError(errorMessage(e, "auth"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string = code) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Basarili olursa Stack.Protected kendiliginden dogru gruba gecirir.
      await verifyCode(parseIdentity(email)!, value);
    } catch (e) {
      setError(errorMessage(e, "auth"));
      setBusy(false);
    }
  }

  async function passwordSignIn() {
    const id = mode === "phone" ? parsePhone(phone) : parseIdentity(email);
    if (!id || (mode === "email" && !("email" in id))) {
      // Google girişi yalnızca Android'de var (`googleSignInAvailable`); iOS'ta onu önermek
      // kullanıcıyı olmayan bir düğmeye yollar.
      setError(
        mode === "phone"
          ? t(googleSignInAvailable ? "auth.invalidPhoneWithGoogle" : "auth.invalidPhone")
          : t("auth.invalidEmail"),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(id, password);
    } catch (e) {
      setError(authError(e));
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

  const showPassword = mode === "phone" || step === "password";

  const identityField = (
    <View style={styles.field}>
      <AppText variant="label" nativeID="identityLabel">
        {mode === "phone" ? t("auth.phoneLabel") : t("auth.emailLabel")}
      </AppText>
      <Input
        accessibilityLabelledBy="identityLabel"
        value={mode === "phone" ? phone : email}
        onChangeText={onIdentityChange}
        placeholder={mode === "phone" ? t("auth.phonePlaceholder") : t("auth.emailPlaceholder")}
        placeholderTextColor={colors.inkMuted}
        // Telefon klavyesi yalnizca acik telefon modunda; harf/@ girilirse e-postaya doneriz.
        keyboardType={mode === "phone" ? "phone-pad" : "email-address"}
        autoCapitalize="none"
        autoComplete={mode === "phone" ? "tel" : "username"}
        autoCorrect={false}
        returnKeyType={showPassword ? "next" : "send"}
        onSubmitEditing={() => (showPassword ? passwordRef.current?.focus() : void sendCode())}
      />
    </View>
  );

  const passwordBlock = (
    <>
      <View style={styles.field}>
        <AppText variant="label" nativeID="passwordLabel">
          {t("auth.passwordLabel")}
        </AppText>
        <PasswordField
          ref={passwordRef}
          accessibilityLabelledBy="passwordLabel"
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={passwordSignIn}
          autoFocus={mode === "email"}
        />
      </View>
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button
        title={t("auth.verify")}
        onPress={passwordSignIn}
        loading={busy}
        disabled={password.length === 0 || oauthBusy}
      />
      {mode === "phone" ? (
        <View style={styles.help}>
          <AppText variant="caption">{t("auth.helpNoPassword")}</AppText>
          <Button variant="secondary" title={t("auth.helpContact")} onPress={() => openSite("contact")} />
          <Button
            variant="ghost"
            title={t("auth.haveResetLink")}
            onPress={() => router.push({ pathname: "/reset-password", params: { mode: "link" } })}
          />
        </View>
      ) : null}
      <Button
        variant="ghost"
        title={t("reset.forgotPassword")}
        onPress={() => {
          setError(null);
          // Sifre sifirlama e-postayla; telefon modunda e-posta alani bos gelir.
          router.push({
            pathname: "/reset-password",
            params: { email: mode === "email" ? email.trim().toLowerCase() : "" },
          });
        }}
      />
      {mode === "email" ? (
        <Button variant="ghost" title={t("auth.useCode")} onPress={() => setStep("email")} />
      ) : null}
    </>
  );

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
            {step === "code" ? (
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
                    onChangeText={(v) => {
                      const next = v.replace(/\D/g, "").slice(0, 6);
                      setCode(next);
                      // 6. hane girilince ayrica dokunmaya gerek yok.
                      if (next.length === 6) void verify(next);
                    }}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    autoFocus
                    style={styles.codeInput}
                  />
                </View>
                {notice ? <Banner tone="success" body={notice} /> : null}
                {error ? <Banner tone="danger" body={error} /> : null}
                <Button title={t("auth.verify")} onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
                <View style={styles.row}>
                  <Button
                    variant="ghost"
                    title={cooldown > 0 ? t("auth.resendIn", { seconds: cooldown }) : t("auth.resend")}
                    onPress={() => sendCode(true)}
                    disabled={busy || cooldown > 0}
                  />
                  <Button
                    variant="ghost"
                    title={t("auth.changeEmail")}
                    onPress={() => {
                      setStep("email");
                      setError(null);
                      setNotice(null);
                    }}
                  />
                </View>
              </>
            ) : (
              <>
                <AppText variant="title">{t("auth.title")}</AppText>
                <Segmented<Mode>
                  options={[
                    { value: "email", label: t("auth.modeEmail") },
                    { value: "phone", label: t("auth.modePhone") },
                  ]}
                  value={mode}
                  onChange={changeMode}
                />
                <AppText variant="caption">
                  {mode === "phone" ? t("auth.phoneSubtitle") : step === "password" ? t("auth.passwordSubtitle") : t("auth.subtitle")}
                </AppText>
                {identityField}
                {showPassword ? (
                  passwordBlock
                ) : (
                  <>
                    {error ? <Banner tone="danger" body={error} /> : null}
                    <Button title={t("auth.sendCode")} onPress={() => sendCode()} loading={busy} disabled={oauthBusy} />
                    <Button
                      variant="ghost"
                      title={t("auth.usePassword")}
                      onPress={() => {
                        setStep("password");
                        setError(null);
                      }}
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
                    {/* Kodla ilk giris hesap acar: kabul cumlesi burada, baglantilariyla. */}
                    <AppText variant="caption" style={styles.legal}>
                      {t("auth.legalPrefix")}
                      <AppText
                        variant="caption"
                        accessibilityRole="link"
                        style={styles.legalLink}
                        onPress={() => openSite("terms")}
                      >
                        {t("auth.legalTerms")}
                      </AppText>
                      {t("auth.legalAnd")}
                      <AppText
                        variant="caption"
                        accessibilityRole="link"
                        style={styles.legalLink}
                        onPress={() => openSite("privacy")}
                      >
                        {t("auth.legalPrivacy")}
                      </AppText>
                      {t("auth.legalSuffix")}
                    </AppText>
                  </>
                )}
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
  help: { gap: space.sm },
  legal: { textAlign: "center" },
  legalLink: { textDecorationLine: "underline", color: colors.ink },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
});
