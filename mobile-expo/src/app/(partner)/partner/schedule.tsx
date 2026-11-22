import { router } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ScheduleEditor } from "@/components/ScheduleEditor";
import { StackHeader } from "@/components/StackHeader";
import { Button, CenterMessage, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { usePartnerShopSelection } from "@/lib/partner-shop";
import { partnerScheduleKey, usePartnerSchedule, usePartnerShop } from "@/lib/queries";
import { colors } from "@/theme/tokens";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";

/**
 * Gun bazli calisma saatleri, 7/24 ve izin gunleri. 7/24 acikken gunluk saatler
 * kullanilmaz, yalnizca izinler gecerlidir (web formu ile ayni). Aktif
 * rezervasyona denk gelen degisikligi sunucu 409 ile reddeder; liste gosterilir.
 */
export default function PartnerScheduleScreen() {
  const { t } = useTranslation();
  const query = usePartnerSchedule();
  // Cok dukkanli esnaf hangi dukkanin saatini degistirdigini gormeli.
  const shop = usePartnerShop();
  const [shopId] = usePartnerShopSelection();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StackHeader title={t("schedule.title")} subtitle={shop.data ? shop.data.name : undefined} />
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "schedule")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <ScheduleEditor
          schedule={query.data}
          basePath="/partner/shop/schedule"
          shopId={shopId}
          invalidateKey={partnerScheduleKey}
          onOpenBooking={(id) => router.push(`/partner/${id}`)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
});
