import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Bath, BadgeCheck, Clock, Info, MapPin, Star, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { hoursLabel } from "@/components/ShopCard";
import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useShop } from "@/lib/queries";
import { colors, fonts, radius, shadow, space } from "@/theme/tokens";

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const query = useShop(id);

  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data) {
    return (
      <CenterMessage
        title={errorMessage(query.error)}
        action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
      />
    );
  }

  const shop = query.data;
  const image = resolveImage(shop.image);
  const hours = hoursLabel(shop, t);
  const weekdays = t("shop.weekdays", { returnObjects: true }) as string[];
  // Haftalik liste pazartesiden baslasin (API 0 = pazar).
  const weekly = [...(shop.weeklyHours ?? [])].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  const todayIdx = new Date().getDay();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <View style={styles.photo}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Store size={56} color={colors.brand} />
          )}
          <IconButton
            label={t("common.back")}
            onPress={() => router.back()}
            style={[styles.back, { top: insets.top + space.sm }, shadow.card]}
          >
            <ArrowLeft size={20} color={colors.ink} />
          </IconButton>
        </View>

        <View style={styles.sheet}>
          <AppText variant="title">{shop.name}</AppText>

          <View style={styles.metaRow}>
            {hours ? (
              <View style={styles.meta}>
                <Clock size={18} color={colors.success} />
                <AppText variant="bodyMedium" style={{ color: colors.success }}>
                  {hours}
                </AppText>
              </View>
            ) : null}
            {shop.rating ? (
              <View style={styles.meta}>
                <Star size={18} color={colors.brand} fill={colors.brand} />
                <AppText variant="bodyMedium">{shop.rating.toFixed(1)}</AppText>
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
              <MapPin size={18} color={colors.inkMuted} />
              <AppText variant="caption" style={{ flex: 1 }}>
                {[shop.address, shop.district, shop.city].filter(Boolean).join(", ")}
              </AppText>
            </View>
          ) : null}
          {shop.hasRestroom ? (
            <View style={styles.meta}>
              <Bath size={18} color={colors.inkMuted} />
              <AppText variant="caption">{t("shop.restroom")}</AppText>
            </View>
          ) : null}

          {shop.isPrelaunch ? (
            <Banner tone="warning" body={t("shop.prelaunch")} />
          ) : (
            <View style={styles.rule}>
              <Info size={20} color={colors.accent} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium">{t("shop.rulesTitle")}</AppText>
                <AppText variant="caption">{t("shop.rulesBody")}</AppText>
              </View>
            </View>
          )}

          {weekly.length > 0 && !shop.open247 ? (
            <Card style={{ gap: space.sm }}>
              <AppText variant="heading">{t("shop.weeklyHours")}</AppText>
              {weekly.map((w) => (
                <View key={w.weekday} style={styles.hourRow}>
                  <AppText
                    variant={w.weekday === todayIdx ? "bodyMedium" : "body"}
                    style={w.weekday === todayIdx && { color: colors.accent }}
                  >
                    {weekdays[w.weekday]}
                  </AppText>
                  <AppText variant={w.weekday === todayIdx ? "bodyMedium" : "body"}>
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
          <View>
            <AppText variant="caption">{t("shop.perDayLabel")}</AppText>
            <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
              {formatMoney(shop.pricePerDay)}
            </AppText>
          </View>
          <Button
            title={t("shop.book")}
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: "/checkout", params: { shopId: shop.id } })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  photo: { height: 260, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  back: { position: "absolute", left: space.lg },
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
  rule: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.control,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  hourRow: { flexDirection: "row", justifyContent: "space-between" },
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
