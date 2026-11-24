import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Heart, Star, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { FavoriteButton } from "@/components/FavoriteButton";
import { RemoteImage } from "@/components/RemoteImage";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Button, CenterMessage } from "@/components/ui";
import { useFavorites } from "@/lib/favorites";
import { formatRating } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useFavoriteShops } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";

/** Cihazdaki favori noktalar; ad, foto ve puan dukkan ucundan taze okunur. */
export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { ids } = useFavorites();
  const shops = useFavoriteShops(ids);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("guestParity.favoritesTitle")} />
      {ids.length === 0 ? (
        <CenterMessage
          art={<Heart size={40} color={colors.borderStrong} strokeWidth={1.5} />}
          title={t("guestParity.favoritesEmptyTitle")}
          body={t("guestParity.favoritesEmptyBody")}
          action={<Button variant="secondary" title={t("home.searchPlaceholder")} onPress={() => router.push("/search")} />}
        />
      ) : (
        <FlatList
          data={ids}
          keyExtractor={(id) => id}
          contentContainerStyle={styles.content}
          renderItem={({ item: id, index }) => {
            const q = shops[index];
            const shop = q?.data;
            const gone = q?.isError;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={!shop}
                onPress={() => router.push(`/shop/${id}`)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }, gone && { opacity: 0.6 }]}
              >
                <View style={styles.photo}>
                  {shop && resolveImage(shop.image) ? (
                    <RemoteImage src={shop.image} width={56} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Store size={22} color={colors.borderStrong} strokeWidth={1.5} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="heading" numberOfLines={2}>
                    {shop?.name ?? (gone ? t("guestParity.favoriteUnavailable") : t("common.loading"))}
                  </AppText>
                  {shop ? (
                    <View style={styles.meta}>
                      {shop.rating ? (
                        <>
                          <Star size={13} color={colors.brand} fill={colors.brand} />
                          <AppText variant="caption">{formatRating(shop.rating)}</AppText>
                        </>
                      ) : null}
                      <AppText variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {[shop.district, shop.city].filter(Boolean).join(", ")}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <FavoriteButton shopId={id} size={18} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: radius.inner + 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
});
