import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Search, Ticket, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { StatusBadge } from "@/components/StatusBadge";
import { AppText, IconButton } from "@/components/ui";
import { formatDayTime } from "@/lib/format";
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
      <View style={[styles.hero, { height: Math.max(340, height * 0.48) }]}>
        <Image source={require("../../../assets/hero.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.scrim} />
        <View style={[styles.heroTop, { paddingTop: insets.top + space.sm }]}>
          <View style={styles.brandPill}>
            <View style={styles.logoDot} />
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
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/bookings/${next.id}`)}
            style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.9 }]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <StatusBadge status={next.status} />
              <AppText variant="heading" numberOfLines={1}>
                {next.shopName}
              </AppText>
              <AppText variant="caption">{formatDayTime(next.checkInTime)}</AppText>
            </View>
            <ChevronRight size={22} color={colors.inkMuted} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/bookings")}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
        >
          <Ticket size={20} color={colors.ink} />
          <AppText variant="bodyMedium" style={{ flex: 1 }}>
            {t("home.myBookings")}
          </AppText>
          <ChevronRight size={20} color={colors.inkMuted} />
        </Pressable>
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
  logoDot: { width: 18, height: 18, borderRadius: 6, backgroundColor: colors.brand },
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
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
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
});
