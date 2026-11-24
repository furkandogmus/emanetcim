import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BadgeCheck, Clock, Star, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { AppText } from "@/components/ui";
import { formatDay, formatDistance, formatMoney, formatRating } from "@/lib/format";
import { nextOpenInstant, openDayKind } from "@/lib/next-open";
import { mediumDaily, shopPriceA11y, stayLabel } from "@/lib/shop-label";
import { RemoteImage } from "@/components/RemoteImage";
import { FavoriteButton } from "@/components/FavoriteButton";
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

/** "Bugun kapali · Yarin 09:00'da acilir"; sonraki acilis bilinmiyorsa kisa uyari. */
export function closedLabel(shop: Pick<NearbyShop, "nextOpen">, t: TFunction) {
  const n = shop.nextOpen;
  if (!n) return t("map.closedNoDate");
  const kind = openDayKind(n);
  if (kind === "today") return t("map.closedToday", { time: n.at });
  if (kind === "tomorrow") return t("map.closedTomorrow", { time: n.at });
  const at = nextOpenInstant(n);
  return t("map.closedDay", { day: at ? formatDay(at) : n.date, time: n.at });
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
  const closed = shop.bookable === false;
  const facts = [
    shop.district || shop.city || null,
    formatDistance(shop.distanceKm),
    shop.bagsAvailable !== undefined && !shop.isPrelaunch ? t("map.available", { count: shop.bagsAvailable }) : null,
  ]
    .filter((f): f is string => Boolean(f))
    // Satir yalnizca " · " arasinda kirilsin: "~60" ile "yer" ayri satira dusmesin.
    .map((f) => f.replace(/ /g, " "));

  // Ekran okuyucu kartin icindeki parcalari tek tek gezmesin: tek ozet cumle.
  const notice = closed
    ? closedLabel(shop, t)
    : shop.hoursNotice?.drop || shop.hoursNotice?.pickup
      ? [
          shop.hoursNotice.drop ? t("map.hoursOpens", { time: shop.hoursNotice.drop.at }) : null,
          shop.hoursNotice.pickup
            ? t(shop.hoursNotice.pickup.reason === "closes" ? "map.hoursCloses" : "map.hoursPickupOpens", {
                time: shop.hoursNotice.pickup.at,
              })
            : null,
        ]
          .filter(Boolean)
          .join(", ")
      : hours;
  const a11yLabel = [
    shop.name,
    shop.isVerified && !shop.isPrelaunch ? t("map.verified") : null,
    shop.rating ? formatRating(shop.rating) : null,
    ...facts,
    shopPriceA11y(shop, t),
    notice,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: !!selected }}
      onPress={() => onPress(shop)}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        (shop.isPrelaunch || closed) && { opacity: closed ? 0.6 : 0.7 },
        pressed && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <View style={styles.photo}>
        {image ? (
          <RemoteImage src={shop.image} width={64} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Store size={24} color={colors.borderStrong} strokeWidth={1.5} />
        )}
        {/* Kartin kendi dokunusundan ayri: kalp karti acmaz. */}
        <View style={styles.fav}>
          <FavoriteButton shopId={shop.id} size={13} />
        </View>
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
          <AppText variant="caption" numberOfLines={2} style={{ flexShrink: 1, fontSize: 13 }}>
            {facts.join(" · ")}
          </AppText>
        </View>

        {closed ? (
          <View style={styles.metaRow}>
            <Clock size={13} color={colors.inkSecondary} />
            <AppText variant="caption" numberOfLines={2} style={{ fontSize: 13, flexShrink: 1 }}>
              {closedLabel(shop, t)}
            </AppText>
          </View>
        ) : shop.hoursNotice?.pickup || shop.hoursNotice?.drop ? (
          // Ikisi de oturtulduysa ikisi de yazilir: biri gizlenince misafir digerini bilmeden gelirdi.
          <View style={{ gap: 2 }}>
            {shop.hoursNotice.drop ? (
              <View style={styles.metaRow}>
                <Clock size={13} color={colors.warning} />
                <AppText variant="caption" numberOfLines={2} style={{ fontSize: 13, color: colors.warning, flexShrink: 1 }}>
                  {t("map.hoursOpens", { time: shop.hoursNotice.drop.at })}
                </AppText>
              </View>
            ) : null}
            {shop.hoursNotice.pickup ? (
              <View style={styles.metaRow}>
                <Clock size={13} color={colors.warning} />
                <AppText variant="caption" numberOfLines={2} style={{ fontSize: 13, color: colors.warning, flexShrink: 1 }}>
                  {t(shop.hoursNotice.pickup.reason === "closes" ? "map.hoursCloses" : "map.hoursPickupOpens", {
                    time: shop.hoursNotice.pickup.at,
                  })}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : hours ? (
          // Yesil "acik" noktasi kaldirildi: secilen ani degil sabit saati gosteriyordu.
          <View style={styles.metaRow}>
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
        ) : shop.stayQuote ? (
          // Aranan kalisin toplami one cikar; gunluk fiyat karsilastirma icin ikincil.
          <>
            {shop.stayQuote.fullTotal != null && shop.stayQuote.fullTotal > shop.stayQuote.total ? (
              <Text style={styles.struck}>{formatMoney(shop.stayQuote.fullTotal)}</Text>
            ) : null}
            <Text style={styles.price}>{formatMoney(shop.stayQuote.total)}</Text>
            <Text style={styles.perDay}>{stayLabel(shop.stayQuote, t)}</Text>
            <Text style={styles.daily}>{t("map.perDayMediumPrice", { price: formatMoney(mediumDaily(shop)) })}</Text>
          </>
        ) : (
          <>
            <Text style={styles.price}>{formatMoney(mediumDaily(shop))}</Text>
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
  fav: { position: "absolute", top: 3, left: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  dot: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  right: { alignItems: "flex-end", alignSelf: "flex-start", paddingTop: 2, maxWidth: 112 },
  struck: { fontSize: 12, color: colors.inkSecondary, textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
  price: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.ink, fontVariant: ["tabular-nums"] },
  perDay: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, textAlign: "right" },
  daily: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, textAlign: "right", marginTop: 2 },
  soon: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSecondary },
});
