import { Share, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Gift, Share2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { SITE_ORIGIN } from "@/lib/images";
import type { ReferralCode } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

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
    const lang = i18n.language === "tr" ? "tr" : "en";
    const role = audience === "partner" ? "role=PARTNER&" : "";
    const url = `${SITE_ORIGIN}/${lang}/register?${role}ref=${encodeURIComponent(data.code)}`;
    const message = t(`referral.${audience}.shareMessage`, { code: data.code, pct: data.discountPct, url });
    // Kullanici paylasimi kapatirsa ya da paylasim sayfasi acilamazsa sessizce gec.
    await Share.share({ message }).catch(() => undefined);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Gift size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="bodyMedium">{t(`referral.${audience}.title`, { pct: data?.discountPct ?? "" })}</AppText>
          <AppText variant="caption">{t(`referral.${audience}.body`, { pct: data?.discountPct ?? "" })}</AppText>
        </View>
      </View>

      {query.isLoading ? (
        <AppText variant="caption">{t("common.loading")}</AppText>
      ) : query.isError || !data ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" style={{ color: colors.danger }}>
            {errorMessage(query.error, "referral")}
          </AppText>
          <Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />
        </View>
      ) : (
        <>
          <View style={styles.codeBox} accessible accessibilityLabel={t("referral.codeLabel", { code: data.code })}>
            <AppText variant="label">{t("referral.yourCode")}</AppText>
            <AppText selectable style={styles.code}>
              {data.code}
            </AppText>
          </View>
          <Button
            title={t("referral.share")}
            icon={<Share2 size={18} color={colors.white} />}
            onPress={() => void share()}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBox: {
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  code: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 3, color: colors.ink },
});
