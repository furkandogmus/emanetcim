import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button } from "@/components/ui";
import { space } from "@/theme/tokens";

/**
 * Liste sonu "Daha fazla" dugmesi. Kaydirinca kendiliginden yukleme yerine dugme:
 * esnaf ve destek hatti listenin bittigini ve devami oldugunu gorebilsin.
 * Hata olursa dugme kalir, tekrar dokunmak yeniden dener.
 */
export function LoadMoreFooter({
  hasMore,
  loading,
  failed,
  onPress,
  label,
}: {
  hasMore: boolean;
  loading: boolean;
  failed?: boolean;
  onPress: () => void;
  label?: string;
}) {
  const { t } = useTranslation();
  if (!hasMore) return null;
  return (
    <View style={{ paddingTop: space.md, gap: space.sm }}>
      {failed ? (
        <AppText variant="caption" style={{ textAlign: "center" }}>
          {t("common.loadMoreFailed")}
        </AppText>
      ) : null}
      <Button variant="secondary" title={label ?? t("common.loadMore")} loading={loading} onPress={onPress} />
    </View>
  );
}
