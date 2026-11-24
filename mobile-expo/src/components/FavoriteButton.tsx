import { Pressable, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useFavorites } from "@/lib/favorites";
import { colors, radius, shadow } from "@/theme/tokens";

/** Kalp: favori dukkani cihazda tutar (web `FavoriteButton` ile ayni davranis). */
export function FavoriteButton({ shopId, size = 18, floating }: { shopId: string; size?: number; floating?: boolean }) {
  const { t } = useTranslation();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(shopId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fav ? t("guestParity.removeFavorite") : t("guestParity.addFavorite")}
      accessibilityState={{ selected: fav }}
      hitSlop={10}
      onPress={() => toggle(shopId)}
      style={({ pressed }) => [
        styles.button,
        { width: size + 14, height: size + 14 },
        floating && shadow.card,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Heart size={size} color={fav ? colors.danger : colors.inkSecondary} fill={fav ? colors.danger : "transparent"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
