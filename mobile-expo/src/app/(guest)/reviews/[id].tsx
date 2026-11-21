import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { LoadMoreFooter } from "@/components/LoadMoreFooter";
import { ReviewItem } from "@/components/ReviewItem";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Button, CenterMessage, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { flattenPages } from "@/lib/paging";
import { useShopReviewsInfinite } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";

/** Dukkanin tum yorumlari, 20'ser. Dukkan ekrani yalnizca ilk bes yorumu gosterir. */
export default function ShopReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const query = useShopReviewsInfinite(id);
  const reviews = flattenPages(query.data, (p) => p.items);
  const total = query.data?.pages[0]?.total;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={total != null ? t("shop.reviews", { count: total }) : t("shop.reviewsTitle")} />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<AppText variant="caption">{t("shop.noReviews")}</AppText>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <ReviewItem review={item} />
            </View>
          )}
          ListFooterComponent={
            <LoadMoreFooter
              hasMore={!!query.hasNextPage}
              loading={query.isFetchingNextPage}
              failed={query.isFetchNextPageError}
              onPress={() => void query.fetchNextPage()}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
  card: {
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
