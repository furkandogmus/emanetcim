import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BadgeCheck, Clock, MapPin, Star, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { AppText } from "@/components/ui";
import { formatKm, formatMoney } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import type { NearbyShop } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

export function hoursLabel(shop: Pick<NearbyShop, "open247" | "openingTime" | "closingTime">, t: TFunction) {
  if (shop.open247) return t("shop.open247");
  if (shop.openingTime && shop.closingTime) {
    return t("shop.hours", { open: shop.openingTime, close: shop.closingTime });
  }
  return null;
}

/** Liste karti: foto, rozetler, yer, saat, fiyat. Talep testi noktasi soluk ve "Yakinda". */
export function ShopCard({ shop, onPress, selected }: { shop: NearbyShop; onPress: () => void; selected?: boolean }) {
  const { t } = useTranslation();
  const image = resolveImage(shop.image);
  const hours = hoursLabel(shop, t);
  const place = [shop.district, shop.city].filter(Boolean).join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.photo}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Store size={32} color={colors.brand} />
        )}
        {shop.isPrelaunch ? (
          <View style={[styles.ribbon, { backgroundColor: colors.inkSecondary }]}>
            <Text style={styles.ribbonText}>{t("map.comingSoon")}</Text>
          </View>
        ) : shop.isVerified ? (
          <View style={styles.ribbon}>
            <BadgeCheck size={14} color={colors.white} />
            <Text style={styles.ribbonText}>{t("map.verified")}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <AppText variant="heading" numberOfLines={2}>
          {shop.name}
        </AppText>
        <View style={styles.metaRow}>
          <MapPin size={14} color={colors.inkMuted} />
          <AppText variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
            {[place, t("map.distance", { km: formatKm(shop.distanceKm) })].filter(Boolean).join(" · ")}
          </AppText>
        </View>
        {hours ? (
          <View style={styles.metaRow}>
            <Clock size={14} color={colors.success} />
            <AppText variant="caption" style={{ color: colors.success }}>
              {hours}
            </AppText>
          </View>
        ) : null}
        <View style={styles.footer}>
          {shop.rating ? (
            <View style={styles.rating}>
              <Star size={13} color={colors.brand} fill={colors.brand} />
              <Text style={styles.ratingText}>{shop.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <View />
          )}
          {!shop.isPrelaunch ? (
            <Text style={styles.price}>
              {formatMoney(shop.pricePerDay)}
              <Text style={styles.perDay}> {t("map.perDay")}</Text>
            </Text>
          ) : null}
        </View>
        {shop.bagsAvailable !== undefined && !shop.isPrelaunch ? (
          <AppText variant="caption">{t("map.available", { count: shop.bagsAvailable })}</AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  selected: { borderColor: colors.brand, borderWidth: 1.5 },
  photo: {
    width: 104,
    minHeight: 112,
    borderRadius: radius.control,
    overflow: "hidden",
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  ribbon: {
    position: "absolute",
    left: 6,
    top: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ribbonText: { color: colors.white, fontFamily: fonts.bodySemibold, fontSize: 11 },
  body: { flex: 1, gap: 4, paddingVertical: 4, paddingRight: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ratingText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  price: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  perDay: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
});
