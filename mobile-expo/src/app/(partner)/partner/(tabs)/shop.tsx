import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { LinkGroup, LinkRow } from "@/components/LinkRow";
import { ProfileView } from "@/components/ProfileView";
import { ShopPhotos } from "@/components/ShopPhotos";
import { ShopSwitcher } from "@/components/ShopSwitcher";
import { AppText, Button, CenterMessage } from "@/components/ui";
import { SEALS_ENABLED } from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import { usePartnerShopSelection } from "@/lib/partner-shop";
import { usePartnerShop } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Dukkanim: secili dukkanin fotograflari ve ayarlari, altinda esnafin kendi hesabi.
 * Ayri "Profil" sekmesi yerine tek ekran: esnaf icin hesap, dukkanin bir parcasi.
 */
export default function PartnerShopScreen() {
  const { t } = useTranslation();
  const [shopId] = usePartnerShopSelection();
  const query = usePartnerShop();
  const go = (path: string) => router.push(path as Href);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
        }
      >
        <View style={{ gap: space.sm }}>
          <AppText variant="title">{t("partner.myShop")}</AppText>
          <ShopSwitcher />
        </View>

        {query.isLoading ? (
          // Dukkan degisirken ekran ziplamasin: fotograf izgarasi ve satirlar yerinde bekler.
          <View style={styles.skeleton}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonTile} />
            ))}
          </View>
        ) : query.isError || !query.data ? (
          <CenterMessage
            title={errorMessage(query.error, "partner")}
            action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
          />
        ) : (
          <>
            <Section title={t("partner.photos")}>
              <ShopPhotos shop={query.data} shopId={shopId} />
            </Section>

            <Section title={t("partner.shopSection")}>
              <LinkGroup>
                <LinkRow label={t("schedule.title")} onPress={() => go("/partner/schedule")} />
                <LinkRow label={t("shopSettings.title")} onPress={() => go("/partner/settings")} />
                {SEALS_ENABLED ? <LinkRow label={t("seals.open")} onPress={() => go("/partner/seals")} /> : null}
                <LinkRow label={t("earnings.title")} onPress={() => go("/partner/earnings")} />
                <LinkRow label={t("referral.title")} onPress={() => go("/partner/referral")} />
              </LinkGroup>
            </Section>
          </>
        )}

        <ProfileView embedded />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl * 2 },
  skeleton: { flexDirection: "row", gap: space.sm, paddingTop: space.xl },
  skeletonTile: { flex: 1, aspectRatio: 1, borderRadius: radius.inner + 2, backgroundColor: colors.surfaceMuted },
});
