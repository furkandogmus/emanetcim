import { Share, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AppText, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { SITE_ORIGIN } from "@/lib/images";
import type { ReferralCode } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { languageInfo } from "@/lib/languages";

/**
 * Kullanicinin davet kodu ve paylas dugmesi. Kod ve indirim orani sunucudan
 * (`referrals/code`); kod yoksa sunucu uretir, istemci hicbir kod uydurmaz.
 * Esnaf linki web'deki `PartnerReferralCard` ile ayni: kayit sayfasi esnaf
 * sekmesinde ve `ref` dolu acilir.
 */
export function ReferralCard({ audience }: { audience: "partner" | "guest" }) {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const userId = state.status === "signedIn" ? state.user.id : null;
  // Anahtarda kullanici: cikis yapilinca sorgu onbellegi temizlenmiyor, baska
  // hesapla girilince onceki kisinin kodu bir an gorunup paylasilabilirdi.
  const query = useQuery({
    enabled: !!userId,
    queryKey: ["referrals", "code", userId],
    queryFn: () => api<ReferralCode>("/referrals/code"),
  });
  const data = query.data;

  async function share() {
    if (!data) return;
    const lang = languageInfo(i18n.language).site;
    const role = audience === "partner" ? "role=PARTNER&" : "";
    const url = `${SITE_ORIGIN}/${lang}/register?${role}ref=${encodeURIComponent(data.code)}`;
    const message = t(`referral.${audience}.shareMessage`, { code: data.code, pct: data.discountPct, url });
    // Kullanici paylasimi kapatirsa ya da paylasim sayfasi acilamazsa sessizce gec.
    await Share.share({ message }).catch(() => undefined);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: space.xs }}>
          {/* Yuzde gelmeden "%  indirim" gibi bos bir metin cizilmesin. */}
          {data ? (
            <>
              <AppText variant="bodyMedium">{t(`referral.${audience}.title`, { pct: data.discountPct })}</AppText>
              <AppText variant="caption">{t(`referral.${audience}.body`, { pct: data.discountPct })}</AppText>
            </>
          ) : (
            <AppText variant="bodyMedium">{t("referral.title")}</AppText>
          )}
        </View>
      </View>

      {query.isLoading ? (
        <AppText variant="caption">{t("common.loading")}</AppText>
      ) : !data ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" style={{ color: colors.danger }}>
            {errorMessage(query.error, "referral")}
          </AppText>
          <Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />
        </View>
      ) : (
        <>
          <View style={styles.codeRow}>
            <View style={styles.codeBox} accessible accessibilityLabel={t("referral.codeLabel", { code: data.code })}>
              <AppText variant="label" style={{ fontSize: 12 }}>
                {t("referral.yourCode")}
              </AppText>
              <AppText selectable style={styles.code}>
                {data.code}
              </AppText>
            </View>
            <Button variant="secondary" title={t("referral.share")} onPress={() => void share()} />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  codeRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  codeBox: {
    flex: 1,
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  code: { fontFamily: fonts.monoMedium, fontSize: 18, lineHeight: 24, letterSpacing: 2, color: colors.ink },
});
