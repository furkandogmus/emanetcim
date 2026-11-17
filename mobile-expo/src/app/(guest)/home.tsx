import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Search, Ticket, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/components/BrandMark";
import { BookingRow } from "@/components/BookingRow";
import { LuggageTag, MapSnippet, SealedBag } from "@/components/Illustrations";
import { CITY_IMAGES } from "@/lib/city-images";
import { CITIES, useSearch } from "@/lib/search";
import { AppText, IconButton } from "@/components/ui";
import { prefetchMapStyle } from "@/lib/map-style";
import { isActiveBooking, useMyBookings } from "@/lib/queries";
import { colors, fonts, radius, shadow, space } from "@/theme/tokens";

export default function HomeScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  useEffect(() => prefetchMapStyle(queryClient), [queryClient]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const bookings = useMyBookings();
  const search = useSearch();
  const next = bookings.data
    ?.filter(isActiveBooking)
    .sort((a, b) => +new Date(a.checkInTime) - +new Date(b.checkInTime))[0];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      bounces={false}
    >
      <View style={[styles.hero, { height: Math.max(340, height * 0.44) }]}>
        <Image source={require("../../../assets/hero.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.scrim} />
        <View style={[styles.heroTop, { paddingTop: insets.top + space.sm }]}>
          <View style={styles.brandPill}>
            <BrandMark size={22} />
            <AppText variant="bodyMedium" style={{ fontFamily: fonts.displayMedium }}>
              BagajPark
            </AppText>
          </View>
          <IconButton label={t("home.profile")} onPress={() => router.push("/profile")}>
            <User size={20} color={colors.ink} />
          </IconButton>
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
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/bookings")}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
          >
            <Ticket size={18} color={colors.inkSecondary} />
            <AppText variant="bodyMedium" style={{ flex: 1 }}>
              {t("home.myBookings")}
            </AppText>
            <ChevronRight size={18} color={colors.inkMuted} />
          </Pressable>
        )}

        <View style={styles.section}>
          <AppText variant="label">{t("home.citiesTitle")}</AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cities}
            style={{ marginHorizontal: -space.xl }}
          >
            {CITIES.filter((c) => CITY_IMAGES[c.label]).map((c) => (
              <Pressable
                key={c.label}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                onPress={() => {
                  search.setPlace(c);
                  router.push({
                    pathname: "/search",
                    params: { from: "city" },
                  });
                }}
                style={({ pressed }) => [styles.cityCard, pressed && { transform: [{ scale: 0.98 }] }]}
              >
                <Image source={CITY_IMAGES[c.label].source} style={StyleSheet.absoluteFill} contentFit="cover" />
                <AppText style={styles.cityName}>{c.label}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <AppText variant="label">{t("home.howTitle")}</AppText>
          <View style={styles.steps}>
            {(["1", "2", "3"] as const).map((n, i) => (
              <View key={n} style={[styles.step, i > 0 && styles.stepDivider]}>
                <View style={styles.stepArt}>
                  {n === "1" ? <MapSnippet width={80} /> : n === "2" ? <LuggageTag size={40} /> : <SealedBag size={52} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyMedium">{t(`home.step${n}Title`)}</AppText>
                  <AppText variant="caption">{t(`home.step${n}Body`)}</AppText>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
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
  cityName: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 22,
    color: colors.white,
    padding: space.md,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
