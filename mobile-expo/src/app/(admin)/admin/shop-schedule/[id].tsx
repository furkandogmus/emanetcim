import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { ScheduleEditor } from "@/components/ScheduleEditor";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { Banner, Button, CenterMessage, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { adminShopScheduleKey, useAdminShop, useAdminShopSchedule } from "@/lib/queries";
import { canEditAdminContent } from "@/lib/review-moderation";
import { colors, space } from "@/theme/tokens";

/** Esnafin saat formu, yonetici ucuyla; cakisan rezervasyon yonetici detayina gider. */
export default function AdminShopScheduleScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { impersonating } = useAuth();
  const readOnly = !canEditAdminContent(impersonating);
  const shop = useAdminShop(id);
  const query = useAdminShopSchedule(id);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StackHeader title={t("adminShop.hours")} subtitle={shop.data?.name} />
      <StaleQueryBanner query={query} />
      {readOnly ? (
        <View style={styles.banner}>
          <Banner tone="warning" body={t("adminShop.readOnly")} />
        </View>
      ) : null}
      {query.isLoading ? (
        <Loading />
      ) : !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "adminShop")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <ScheduleEditor
          schedule={query.data}
          basePath={`/admin/shops/${encodeURIComponent(id)}/schedule`}
          invalidateKey={adminShopScheduleKey(id)}
          onOpenBooking={(bookingId) => router.push(`/admin/booking/${bookingId}`)}
          hint={t("adminShop.scheduleHint")}
          errorNamespace="adminShop"
          readOnly={readOnly}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  banner: { paddingHorizontal: space.xl },
});
