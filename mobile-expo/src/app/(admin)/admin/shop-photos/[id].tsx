import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { MAX_SHOP_PHOTOS, ShopPhotoGrid } from "@/components/ShopPhotos";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { AppText, Banner, Button, CenterMessage, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { adminShopPhotosKey, keys, useAdminShop, useAdminShopPhotos } from "@/lib/queries";
import { canEditAdminContent } from "@/lib/review-moderation";
import { colors, space } from "@/theme/tokens";

/** Esnafin fotograf izgarasi, yonetici uclariyla (`admin/shops/:id/image[s]`). */
export default function AdminShopPhotosScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { impersonating } = useAuth();
  const readOnly = !canEditAdminContent(impersonating);
  const shop = useAdminShop(id);
  const query = useAdminShopPhotos(id);
  const base = `/admin/shops/${encodeURIComponent(id)}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("adminShop.photos")} subtitle={shop.data?.name} />
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "adminShop")}
          action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {readOnly ? <Banner tone="warning" body={t("adminShop.readOnly")} /> : null}
          <AppText variant="caption">{t("adminShop.contentHint")}</AppText>
          <ShopPhotoGrid
            image={query.data.image}
            gallery={query.data.gallery}
            path={(sub) => `${base}${sub}`}
            onChanged={() =>
              Promise.all([
                queryClient.invalidateQueries({ queryKey: adminShopPhotosKey(id) }),
                queryClient.invalidateQueries({ queryKey: [...keys.admin, "shops"] }),
              ])
            }
            errorNamespace="adminShop"
            hint={t("adminShop.photosHint", { max: MAX_SHOP_PHOTOS })}
            emptyHint={t("adminShop.photosEmptyHint")}
            readOnly={readOnly}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.md },
});
