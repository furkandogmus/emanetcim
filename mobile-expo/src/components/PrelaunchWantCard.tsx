import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppText, Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getDeviceId } from "@/lib/device-id";
import { errorMessage } from "@/lib/errors";
import { usePrelaunchWant } from "@/lib/queries";
import type { PrelaunchWantResponse } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

/**
 * Talep testi noktasi: tek dokunusla "burada olsun" sayilir; girisliyse hesap
 * e-postasina "acilinca haber ver" kaydi da yazilir (web `PrelaunchDemandPanel`).
 * Sayi sunucudan gelen TAZE toplamdir, yerel `+1` degil.
 */
export function PrelaunchWantCard({ shopId, initialCount }: { shopId: string; initialCount: number }) {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const signedIn = state.status === "signedIn";
  const want = usePrelaunchWant(shopId);
  const [result, setResult] = useState<PrelaunchWantResponse | null>(null);
  const count = result?.count ?? initialCount;

  async function submit() {
    if (want.isPending || result) return;
    const deviceId = await getDeviceId();
    want.mutate({ deviceId, notify: signedIn, locale: i18n.language }, { onSuccess: setResult });
  }

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 4 }}>
        <AppText variant="heading">{t("guestParity.prelaunchTitle")}</AppText>
        <AppText variant="caption">{t("guestParity.prelaunchBody")}</AppText>
      </View>
      <Button
        title={result ? t("guestParity.wantDone") : t("guestParity.wantCta")}
        disabled={!!result}
        loading={want.isPending}
        onPress={() => void submit()}
      />
      <AppText variant="caption" accessibilityLiveRegion="polite">
        {count > 0 ? t("guestParity.wantCount", { count }) : t("guestParity.wantFirst")}
      </AppText>
      {result?.subscribed ? <AppText variant="caption">{t("guestParity.subscribed")}</AppText> : null}
      {result && !signedIn ? (
        <Button variant="secondary" title={t("guestParity.signInToNotify")} onPress={() => router.push("/login")} />
      ) : null}
      {want.isError ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {errorMessage(want.error, "guestParity")}
        </AppText>
      ) : null}
    </Card>
  );
}
