import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/Field";
import { PasswordField } from "@/components/PasswordField";
import { AppText, Banner, Button } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { MAX_PASSWORD, MIN_PASSWORD, isValidNewPassword } from "@/lib/password-rules";
import { fonts, space } from "@/theme/tokens";

/** Yeni kod istemeden once beklenen sure; e-posta gelmeden ikinci istek atilmasin. */
export const RESET_RESEND_COOLDOWN_S = 60;
const CODE_LENGTH = 6;

/**
 * E-postadaki 6 haneli kod + yeni sifre. Kod alani yapistirmayi ve "123 456" gibi
 * bosluklu yaziyi kabul eder; 6. hanede gonderilmez cunku sifre de gerekli.
 * `onSubmit` hata firlatirsa kod `reset.errors.*` ile cevrilir.
 */
export function ResetCodeForm({
  onSubmit,
  onResend,
  initialCooldown = RESET_RESEND_COOLDOWN_S,
}: {
  onSubmit: (code: string, password: string) => Promise<void>;
  onResend: () => Promise<void>;
  initialCooldown?: number;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(initialCooldown);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const ready = code.length === CODE_LENGTH && isValidNewPassword(password);

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onSubmit(code, password);
    } catch (e) {
      setError(errorMessage(e, "reset"));
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await onResend();
      // Eski kod sunucuda gecersiz olabilir: kutu bosalir, en son gelen kod yazilsin.
      setCode("");
      setNotice(t("reset.codeResent"));
      setCooldown(RESET_RESEND_COOLDOWN_S);
    } catch (e) {
      setError(errorMessage(e, "reset"));
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <AppText variant="label" nativeID="resetCodeLabel">
          {t("reset.codeLabel")}
        </AppText>
        <Input
          accessibilityLabelledBy="resetCodeLabel"
          accessibilityLabel={t("reset.codeLabel")}
          value={code}
          onChangeText={(v) => {
            setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH));
            setError(null);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          // maxLength yok: "123 456" yapistirilinca kesilmeden once rakamlar ayiklanir.
          autoFocus
          style={styles.codeInput}
        />
      </View>
      <View style={styles.field}>
        <AppText variant="label" nativeID="resetCodePasswordLabel">
          {t("reset.newPasswordLabel")}
        </AppText>
        <PasswordField
          accessibilityLabelledBy="resetCodePasswordLabel"
          accessibilityLabel={t("reset.newPasswordLabel")}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={MAX_PASSWORD}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <AppText variant="caption">{t("reset.passwordRule", { min: MIN_PASSWORD })}</AppText>
      </View>
      {notice ? <Banner tone="success" body={notice} /> : null}
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button title={t("reset.submitCode")} onPress={() => void submit()} loading={busy} disabled={!ready} />
      <Button
        variant="ghost"
        title={cooldown > 0 ? t("reset.resendCodeIn", { seconds: cooldown }) : t("reset.resendCode")}
        onPress={() => void resend()}
        loading={resending}
        disabled={busy || cooldown > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  field: { gap: space.sm },
  codeInput: { fontFamily: fonts.monoMedium, fontSize: 26, letterSpacing: 10, textAlign: "center" },
});
