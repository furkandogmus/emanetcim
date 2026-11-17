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
  const next = bookings.data
    ?.filter(isActiveBooking)
    .sort((a, b) => +new Date(a.checkInTime) - +new Date(b.checkInTime))[0];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} bounces={false}>
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
          <AppText variant="label">{t("home.howTitle")}</AppText>
          <View style={styles.steps}>
            {(["1", "2", "3"] as const).map((n, i) => (
              <View key={n} style={styles.step}>
                <View style={styles.stepRail}>
                  <View style={styles.stepNum}>
                    <AppText variant="mono" style={{ fontSize: 13, color: colors.accent }}>
                      {n}
                    </AppText>
                  </View>
                  {i < 2 ? <View style={styles.stepLine} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2, paddingBottom: i < 2 ? space.lg : 0 }}>
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
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(28,25,23,0.38)" },
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
  heroTitle: { color: colors.white, paddingHorizontal: space.xl, paddingBottom: space.xxl + space.lg },
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
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  step: { flexDirection: "row", gap: space.md },
  stepRail: { alignItems: "center", width: 28 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: space.xs },
});
