import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { ChevronRight, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/components/BrandMark";
import { BookingRow } from "@/components/BookingRow";
import { LuggageTag, MapSnippet, SealedBag } from "@/components/Illustrations";
import { InfoSheet } from "@/components/InfoSheet";
import { CITY_IMAGES } from "@/lib/city-images";
import { formatDayTime } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useSearch } from "@/lib/search";
import { AppText } from "@/components/ui";
import { prefetchMapStyle } from "@/lib/map-style";
import { isActiveBooking, useCities, useMyBookings } from "@/lib/queries";
import type { BookingSummary } from "@/lib/types";
import { colors, fonts, radius, shadow, space } from "@/theme/tokens";

export default function HomeScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  useEffect(() => prefetchMapStyle(queryClient), [queryClient]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const bookings = useMyBookings();
  const search = useSearch();
  const cities = useCities();
  const active = (bookings.data ?? [])
    .filter((b) => isActiveBooking(b))
    .sort((a, b) => +new Date(a.checkInTime) - +new Date(b.checkInTime));
  const next = active[0];
  // "Nasil calisir" adimlari bu iki kayda gore canli: QR'i hazir olan teslim, dukkandaki valiz.
  const toDrop = active.find((b) => b.status !== "CHECKED_IN");
  const atShop = active.find((b) => b.status === "CHECKED_IN");
  const [sheet, setSheet] = useState<null | "noBooking" | { notDropped: BookingSummary }>(null);
  const [locating, setLocating] = useState(false);

  /** Konum izni varsa haritayi dogrudan "yakinimda" acar; yoksa arama sihirbazina gider. */
  async function openNearby() {
    if (locating) return;
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        router.push("/search");
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      search.setPlace({
        label: t("map.nearYou"),
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        isCurrent: true,
      });
      router.push("/map");
    } catch {
      router.push("/search");
    } finally {
      setLocating(false);
    }
  }

  const steps = [
    {
      n: "1",
      art: <MapSnippet width={80} />,
      hint: null as string | null,
      onPress: () => void openNearby(),
    },
    {
      n: "2",
      art: <LuggageTag size={40} />,
      hint: toDrop ? t("home.qrReady", { shop: toDrop.shopName }) : null,
      // Valiz zaten dukkandaysa ayni QR alma kodudur: o rezervasyon acilir.
      onPress: () => {
        const b = toDrop ?? atShop;
        if (b) router.push(`/bookings/${b.id}`);
        else setSheet("noBooking");
      },
    },
    {
      n: "3",
      art: <SealedBag size={52} />,
      hint: atShop ? t("home.pickupReady", { shop: atShop.shopName }) : null,
      onPress: () =>
        atShop
          ? router.push(`/bookings/${atShop.id}`)
          : toDrop
            ? setSheet({ notDropped: toDrop })
            : setSheet("noBooking"),
    },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      bounces={false}
    >
      <View style={[styles.hero, { height: Math.max(340, height * 0.44) }]}>
        <Image source={require("../../../../assets/hero.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.scrim} />
        <View style={[styles.heroTop, { paddingTop: insets.top + space.sm }]}>
          <View style={styles.brandPill}>
            <BrandMark size={22} />
            <AppText variant="bodyMedium" style={{ fontFamily: fonts.displayMedium }}>
              BagajPark
            </AppText>
          </View>
        </View>
        <AppText variant="display" style={styles.heroTitle}>
          {t("home.heroTitle")}
        </AppText>
      </View>

      <View style={styles.body}>
        <Pressable
          accessibilityRole="search"
          onPress={() => router.push("/search")}
          style={({ pressed }) => [styles.searchPill, pressed && { opacity: 0.9 }]}
        >
          <Search size={22} color={colors.brand} />
          <AppText variant="bodyMedium" style={{ color: colors.inkMuted }}>
            {t("home.searchPlaceholder")}
          </AppText>
        </Pressable>

        {next ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <AppText variant="label">{t("home.nextLabel")}</AppText>
              <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push("/bookings")}>
                <AppText variant="label" style={{ color: colors.accent }}>
                  {t("home.allBookings")}
                </AppText>
              </Pressable>
            </View>
            <BookingRow booking={next} title={next.shopName} onPress={() => router.push(`/bookings/${next.id}`)} />
          </View>
        ) : null}

        {/* Sunucudan: yalnizca dukkani olan sehirler, cok noktasi olan once. Hata/bos ise bolum gizli. */}
        {cities.isLoading || (cities.data?.length ?? 0) > 0 ? (
          <View style={styles.section}>
            <AppText variant="label">{t("home.citiesTitle")}</AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cities}
              style={{ marginHorizontal: -space.xl }}
            >
              {cities.isLoading
                ? [0, 1, 2].map((i) => <View key={i} style={styles.cityCard} />)
                : cities.data!.map((c) => {
                    const local = CITY_IMAGES[c.name]?.source;
                    const remote = resolveImage(c.coverImage);
                    const photo = local ?? (remote ? { uri: remote } : null);
                    return (
                      <Pressable
                        key={c.name}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.name}, ${t("home.citySpots", { count: c.shopCount })}`}
                        onPress={() => {
                          search.setPlace({ label: c.name, latitude: c.latitude, longitude: c.longitude });
                          router.push({ pathname: "/search", params: { from: "city" } });
                        }}
                        style={({ pressed }) => [styles.cityCard, pressed && { transform: [{ scale: 0.98 }] }]}
                      >
                        {photo ? (
                          <>
                            <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
                            <View style={styles.cityScrim} />
                          </>
                        ) : (
                          <View style={styles.cityArt}>
                            <MapSnippet width={104} />
                          </View>
                        )}
                        <View style={styles.cityText}>
                          <AppText style={[styles.cityName, !photo && styles.cityOnLight]}>{c.name}</AppText>
                          <AppText style={[styles.citySpots, !photo && styles.cityOnLightMuted]}>
                            {t("home.citySpots", { count: c.shopCount })}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="label">{t("home.howTitle")}</AppText>
          <View style={styles.steps}>
            {steps.map((step, i) => (
              <Pressable
                key={step.n}
                accessibilityRole="button"
                onPress={step.onPress}
                style={({ pressed }) => [
                  styles.step,
                  i > 0 && styles.stepDivider,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View
                  style={styles.stepArt}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                >
                  {step.art}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyMedium">{t(`home.step${step.n}Title`)}</AppText>
                  {step.hint ? (
                    <View style={styles.hint}>
                      <View style={styles.hintDot} />
                      <AppText variant="caption" numberOfLines={1} style={{ flex: 1, color: colors.accent }}>
                        {step.hint}
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="caption">{t(`home.step${step.n}Body`)}</AppText>
                  )}
                </View>
                <ChevronRight size={18} color={colors.borderStrong} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <InfoSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        art={sheet === "noBooking" ? <LuggageTag size={44} /> : <SealedBag size={56} />}
        title={sheet === "noBooking" || !sheet ? t("home.sheet.noBookingTitle") : t("home.sheet.notDroppedTitle")}
        body={
          sheet === "noBooking" || !sheet
            ? t("home.sheet.noBookingBody")
            : t("home.sheet.notDroppedBody", {
                shop: sheet.notDropped.shopName,
                time: formatDayTime(sheet.notDropped.checkInTime),
              })
        }
        actionLabel={sheet === "noBooking" || !sheet ? t("home.sheet.findSpot") : t("home.sheet.openBooking")}
        onAction={() => {
          if (sheet && sheet !== "noBooking") router.push(`/bookings/${sheet.notDropped.id}`);
          else void openNearby();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { justifyContent: "space-between", backgroundColor: colors.ink },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(28,25,23,0.38)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.xl,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  heroTitle: {
    color: colors.white,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl + space.lg,
  },
  body: { marginTop: -space.xl, paddingHorizontal: space.xl, gap: space.lg },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.floating,
  },
  section: { gap: space.sm },
  cities: { paddingHorizontal: space.xl, gap: space.md },
  cityCard: {
    width: 132,
    height: 168,
    borderRadius: radius.card,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceMuted,
  },
  cityScrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.18)" },
  cityArt: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", paddingTop: space.lg },
  cityText: { padding: space.md, gap: 0 },
  citySpots: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.9)",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  cityOnLight: { color: colors.ink, textShadowRadius: 0 },
  cityOnLightMuted: { color: colors.inkSecondary, textShadowRadius: 0 },
  hint: { flexDirection: "row", alignItems: "center", gap: 6 },
  hintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  cityName: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 22,
    color: colors.white,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  steps: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  step: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.lg },
  stepDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  stepArt: {
    width: 64,
    height: 64,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
