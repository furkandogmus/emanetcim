import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BadgeCheck, Clock, Star, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { AppText } from "@/components/ui";
import { formatDistance, formatMoney, formatRating } from "@/lib/format";
import { RemoteImage } from "@/components/RemoteImage";
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

/**
 * Liste karti: kucuk foto, ad, tek satir ozet (puan, mesafe, kapasite), saat ve sagda fiyat.
 * Talep testi noktasi soluk ve "Yakinda".
 */
export const ShopCard = memo(function ShopCard({
  shop,
  onPress,
  selected,
}: {
  shop: NearbyShop;
  onPress: (shop: NearbyShop) => void;
  selected?: boolean;
}) {
  const { t } = useTranslation();
  const image = resolveImage(shop.image);
  const hours = hoursLabel(shop, t);
  const facts = [
    shop.district || shop.city || null,
    formatDistance(shop.distanceKm),
    shop.bagsAvailable !== undefined && !shop.isPrelaunch ? t("map.available", { count: shop.bagsAvailable }) : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(shop)}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        shop.isPrelaunch && { opacity: 0.7 },
        pressed && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <View style={styles.photo}>
        {image ? (
          <RemoteImage src={shop.image} width={64} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Store size={24} color={colors.borderStrong} strokeWidth={1.5} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="heading" numberOfLines={2} style={{ flexShrink: 1 }}>
            {shop.name}
          </AppText>
          {shop.isVerified && !shop.isPrelaunch ? (
            <BadgeCheck size={16} color={colors.accent} accessibilityLabel={t("map.verified")} />
          ) : null}
        </View>

        <View style={styles.metaRow}>
          {shop.rating ? (
            <>
              <Star size={13} color={colors.brand} fill={colors.brand} />
              <Text style={styles.ratingText}>{formatRating(shop.rating)}</Text>
              <Text style={styles.dot}>·</Text>
            </>
          ) : null}
          <AppText variant="caption" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13 }}>
            {facts.join(" · ")}
          </AppText>
        </View>

        {shop.hoursNotice?.pickup || shop.hoursNotice?.drop ? (
          <View style={styles.metaRow}>
            <Clock size={13} color={colors.warning} />
            <AppText variant="caption" numberOfLines={2} style={{ fontSize: 13, color: colors.warning, flexShrink: 1 }}>
              {shop.hoursNotice.pickup
                ? t(shop.hoursNotice.pickup.reason === "closes" ? "map.hoursCloses" : "map.hoursPickupOpens", {
                    time: shop.hoursNotice.pickup.at,
                  })
                : t("map.hoursOpens", { time: shop.hoursNotice.drop!.at })}
            </AppText>
          </View>
        ) : hours ? (
          <View style={styles.metaRow}>
            <View style={styles.openDot} />
            <AppText variant="caption" style={{ fontSize: 13, color: colors.inkSecondary }}>
              {hours}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.right}>
        {shop.isPrelaunch ? (
          <View style={styles.soon}>
            <Text style={styles.soonText}>{t("map.comingSoon")}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.price}>{formatMoney(shop.priceRange?.medium ?? shop.pricePerDay)}</Text>
            <Text style={styles.perDay}>{t("map.perDayMedium")}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  selected: { borderColor: colors.brand, borderWidth: 1.5 },
  photo: {
    width: 64,
    height: 64,
    borderRadius: radius.inner + 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  dot: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 2 },
  right: { alignItems: "flex-end", alignSelf: "flex-start", paddingTop: 2, maxWidth: 96 },
  price: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.ink, fontVariant: ["tabular-nums"] },
  perDay: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, textAlign: "right" },
  soon: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSecondary },
});
