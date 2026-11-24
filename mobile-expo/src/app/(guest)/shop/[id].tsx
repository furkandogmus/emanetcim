import { useEffect, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BadgeCheck, Cctv, Luggage, Snowflake, Star, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { FavoriteButton } from "@/components/FavoriteButton";
import { PhotoPager } from "@/components/PhotoPager";
import { PrelaunchWantCard } from "@/components/PrelaunchWantCard";
import { ReviewItem } from "@/components/ReviewItem";
import { hoursLabel } from "@/components/ShopCard";
import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { rememberCheckoutIntent, takeCheckoutIntent } from "@/lib/after-login";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { formatDay, formatMoney, formatRating, formatStayRange } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { goBackOr } from "@/lib/navigation";
import { useShop, useShopReviews } from "@/lib/queries";
import { totalBags, useSearch } from "@/lib/search";
import { isoWeekdayIndex, wallParts } from "@/lib/time";
import { colors, fonts, radius, shadow, space } from "@/theme/tokens";

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const query = useShop(id);
  const search = useSearch();
  const { state } = useAuth();
  const signedIn = state.status === "signedIn";

  // Girissiz "Rezervasyon yap" -> giris -> geri donunce ayni dukkanin odemesine devam.
  useEffect(() => {
    if (signedIn && id && takeCheckoutIntent(id)) {
      router.push({ pathname: "/checkout", params: { shopId: id } });
    }
  }, [signedIn, id]);

  function book(shopId: string) {
    if (!signedIn) {
      rememberCheckoutIntent(shopId);
      router.push("/login");
      return;
    }
    router.push({ pathname: "/checkout", params: { shopId } });
  }

  // Yuklenirken de geri dugmesi: iOS'ta donanim geri tusu yok, bos ekranda kalinirdi.
  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ position: "absolute", top: insets.top + space.sm, left: space.lg, zIndex: 1 }}>
          <IconButton label={t("common.back")} onPress={goBackOr}>
            <ArrowLeft size={20} color={colors.ink} />
          </IconButton>
        </View>
        <Loading />
      </View>
    );
  }
  if (!query.data) {
    return (
      <CenterMessage
        title={errorMessage(query.error, "shop")}
        action={
          query.error instanceof ApiError && query.error.code === "not_found" ? (
            // Silinmis / kapanmis nokta: geri donulecek yer olmayabilir (uygulama baglantisi).
            <Button variant="secondary" title={t("shop.nearbyAction")} onPress={() => router.replace(search.place ? "/map" : "/")} />
          ) : (
            <Button variant="secondary" title={t("common.back")} onPress={goBackOr} />
          )
        }
      />
    );
  }

  const shop = query.data;
  // Sunucu indirimli fiyati verir; alan yoksa (eski sunucu) ya da oran 0 ise duz fiyat.
  const appPrice = shop.appPrice && shop.appPrice.pct > 0 ? shop.appPrice : null;
  // Kapak once, galeri ardindan; kapak yoksa galeri yine gosterilir.
  const photos = [shop.image, ...(shop.gallery ?? [])].filter((u): u is string => !!resolveImage(u));
  const hours = hoursLabel(shop, t);
  const weekdays = t("shop.weekdays", { returnObjects: true }) as string[];
  // API ISO hafta gunu verir (1 = pazartesi ... 7 = pazar); `weekdays` ve `wallParts` ise
  // pazar = 0. Liste pazartesiden baslar.
  const weekly = [...(shop.weeklyHours ?? [])].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  const todayIdx = wallParts(new Date()).weekday; // 0 = pazar

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        {/* Fotografsiz dukkanda 260px bos turuncu kutu yerine kisa, notr bir baslik. */}
        <View style={[styles.photo, photos.length === 0 && { height: insets.top + 140, backgroundColor: colors.surfaceMuted }]}>
          {photos.length > 0 ? (
            <PhotoPager photos={photos} height={280} />
          ) : (
            <Store size={40} color={colors.borderStrong} strokeWidth={1.5} style={{ marginTop: insets.top }} />
          )}
          <IconButton
            label={t("common.back")}
            onPress={goBackOr}
            style={[styles.back, { top: insets.top + space.sm }, shadow.card]}
          >
            <ArrowLeft size={20} color={colors.ink} />
          </IconButton>
          <View style={[styles.favorite, { top: insets.top + space.sm }]}>
            <FavoriteButton shopId={shop.id} size={20} floating />
          </View>
        </View>

        <View style={styles.sheet}>
          <AppText variant="title">{shop.name}</AppText>

          <View style={styles.metaRow}>
            {hours ? (
              <View style={styles.meta}>
                <AppText variant="bodyMedium">{hours}</AppText>
              </View>
            ) : null}
            {shop.rating ? (
              <View style={styles.meta}>
                <Star size={18} color={colors.brand} fill={colors.brand} />
                <AppText variant="bodyMedium">{formatRating(shop.rating)}</AppText>
              </View>
            ) : null}
            {shop.isVerified ? (
              <View style={styles.meta}>
                <BadgeCheck size={18} color={colors.accent} />
                <AppText variant="bodyMedium">{t("map.verified")}</AppText>
              </View>
            ) : null}
          </View>

          {shop.address || shop.city ? (
            <View style={styles.meta}>
              <AppText variant="caption" style={{ flex: 1 }}>
                {/* Adres cogu kayitta ilce/sehri zaten iceriyor; tekrar eklenmez. */}
                {[shop.address, shop.district, shop.city]
                  .filter((p, i, all): p is string => !!p && !all.slice(0, i).some((q) => q?.includes(p)))
                  .join(", ")}
              </AppText>
            </View>
          ) : null}
          {shop.hasRestroom ? (
            <AppText variant="caption">{t("shop.restroom")}</AppText>
          ) : null}

          {/* Web dukkan sayfasindaki olanak rozetleri; harita suzgeci ayni alanlari okur. */}
          {shop.hasCctv || shop.hasClimateControl || shop.acceptsLargeItems ? (
            <View style={styles.amenities}>
              {shop.hasCctv ? <Amenity icon={<Cctv size={16} color={colors.accent} />} label={t("guestParity.cctv")} /> : null}
              {shop.hasClimateControl ? (
                <Amenity icon={<Snowflake size={16} color={colors.accent} />} label={t("guestParity.climate")} />
              ) : null}
              {shop.acceptsLargeItems ? (
                <Amenity icon={<Luggage size={16} color={colors.accent} />} label={t("guestParity.largeItems")} />
              ) : null}
            </View>
          ) : null}

          {shop.isPrelaunch ? (
            <>
              <Banner tone="warning" body={t("shop.prelaunch")} />
              <PrelaunchWantCard shopId={shop.id} initialCount={shop.prelaunchWantCount ?? 0} />
            </>
          ) : (
            <View style={styles.rule}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium">{t("shop.rulesTitle")}</AppText>
                <AppText variant="caption">{t("shop.rulesBody")}</AppText>
              </View>
            </View>
          )}

          {!shop.isPrelaunch ? (
            // Secilen tarih ve valiz burada da gorunur; checkout bunlari sessizce okuyordu.
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/search", params: { returnTo: "back", step: "1" } })}
              style={styles.selection}
            >
              <AppText variant="bodyMedium" numberOfLines={2} style={{ flex: 1 }}>
                {t("shop.selection", {
                  when: `${formatDay(search.checkIn)}, ${formatStayRange(search.checkIn, search.checkOut)}`,
                  bags: t("common.bag", { count: totalBags(search.bags) }),
                })}
              </AppText>
              <AppText variant="caption" style={{ color: colors.accent }}>
                {t("shop.change")}
              </AppText>
            </Pressable>
          ) : null}

          {/* Boyut basina fiyat sunucudan (yuvarlanmis); istemci carpan uygulamaz. */}
          {!shop.isPrelaunch && shop.priceBySize ? (
            <Card style={{ gap: space.sm }}>
              <AppText variant="heading">{t("shop.prices")}</AppText>
              {appPrice ? (
                <AppText variant="caption" style={{ color: colors.success }}>
                  {t("appDiscount.badge", { pct: appPrice.pct })}
                </AppText>
              ) : null}
              {(
                [
                  ["s", shop.priceBySize.s],
                  ["m", shop.priceBySize.m],
                  ["xl", shop.priceBySize.xl],
                ] as const
              ).map(([size, price]) => (
                <View key={size} style={styles.hourRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium">{t(`bags.${size}`)}</AppText>
                    <AppText variant="caption">{t(`bags.${size}Desc`)}</AppText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {appPrice ? (
                      <AppText variant="caption" style={styles.struck}>
                        {formatMoney(price)}
                      </AppText>
                    ) : null}
                    <AppText variant="bodyMedium" style={{ fontVariant: ["tabular-nums"] }}>
                      {t("shop.perDay", { price: formatMoney(appPrice ? appPrice.priceBySize[size] : price) })}
                    </AppText>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <Reviews shopId={shop.id} />

          {weekly.length > 0 && !shop.open247 ? (
            <Card style={{ gap: space.sm }}>
              <AppText variant="heading">{t("shop.weeklyHours")}</AppText>
              {weekly.map((w) => (
                <View key={w.weekday} style={styles.hourRow}>
                  <AppText
                    variant={isoWeekdayIndex(w.weekday) === todayIdx ? "bodyMedium" : "body"}
                    style={isoWeekdayIndex(w.weekday) === todayIdx && { color: colors.accent }}
                  >
                    {weekdays[isoWeekdayIndex(w.weekday)]}
                  </AppText>
                  <AppText variant={isoWeekdayIndex(w.weekday) === todayIdx ? "bodyMedium" : "body"}>
                    {w.isClosed ? t("shop.closed") : `${w.openingTime} – ${w.closingTime}`}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {!shop.isPrelaunch ? (
        <View style={[styles.cta, { paddingBottom: insets.bottom + space.md }]}>
          {shop.priceBySize ? (
            <View>
              <AppText variant="caption">
                {appPrice ? t("appDiscount.label") : t("shop.perDayMediumLabel")}
              </AppText>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.xs }}>
                {appPrice ? (
                  <AppText variant="caption" style={styles.struck}>
                    {formatMoney(shop.priceBySize.m)}
                  </AppText>
                ) : null}
                <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
                  {formatMoney(appPrice ? appPrice.priceBySize.m : shop.priceBySize.m)}
                </AppText>
              </View>
            </View>
          ) : null}
          <Button
            title={t("shop.book")}
            style={{ flex: 1 }}
            onPress={() => book(shop.id)}
          />
        </View>
      ) : null}
    </View>
  );
}

function Amenity({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.amenity}>
      {icon}
      <AppText variant="caption" style={{ color: colors.ink }}>
        {label}
      </AppText>
    </View>
  );
}

function Reviews({ shopId }: { shopId: string }) {
  const { t } = useTranslation();
  const query = useShopReviews(shopId);
  // Yorum yuklenemezse dukkan ekrani bozulmasin; bolum sessizce gizlenir.
  if (!query.data) return null;
  const { items, total } = query.data;
  return (
    <Card style={{ gap: space.md }}>
      <AppText variant="heading">{t("shop.reviews", { count: total })}</AppText>
      {items.length === 0 ? <AppText variant="caption">{t("shop.noReviews")}</AppText> : null}
      {items.map((r) => (
        <ReviewItem key={r.id} review={r} shopId={shopId} />
      ))}
      {total > items.length ? (
        <Button
          variant="secondary"
          title={t("shop.allReviews", { count: total })}
          onPress={() => router.push(`/reviews/${encodeURIComponent(shopId)}`)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  struck: { textDecorationLine: "line-through", color: colors.inkSecondary },
  root: { flex: 1, backgroundColor: colors.bg },
  photo: { height: 280, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  back: { position: "absolute", left: space.lg },
  favorite: { position: "absolute", right: space.lg },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  amenity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheet: {
    marginTop: -space.xl,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.xl,
    gap: space.lg,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  selection: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rule: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  hourRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md, paddingVertical: 4 },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
