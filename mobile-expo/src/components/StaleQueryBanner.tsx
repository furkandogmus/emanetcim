import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Banner, Button } from "@/components/ui";
import { isStaleError, type QueryViewState } from "@/lib/query-view";
import { space } from "@/theme/tokens";

/**
 * Yenileme basarisiz oldu ama onbellekteki veri ekranda duruyor: engellemeyen kucuk bant.
 * Veri yoksa ya da hata yoksa hicbir sey cizmez.
 */
export function StaleQueryBanner({ query }: { query: QueryViewState & { refetch: () => unknown } }) {
  const { t } = useTranslation();
  if (!isStaleError(query)) return null;
  return (
    <View style={{ gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.sm }}>
      <Banner tone="warning" body={t("common.staleData")} />
      <Button variant="secondary" title={t("common.retry")} onPress={() => void query.refetch()} />
    </View>
  );
}
