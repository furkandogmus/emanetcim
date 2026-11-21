import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { getDevicePosition, type LocationFailure } from "@/lib/location";
import { Image } from "expo-image";
import { ArrowLeft, ChevronRight, LocateFixed, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagCounter } from "@/components/BagCounter";
import { PlaceSearch } from "@/components/PlaceSearch";
import { StayWindowPicker, isStayWindowValid } from "@/components/StayWindowPicker";
import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { CITY_IMAGES } from "@/lib/city-images";
import { RemoteImage } from "@/components/RemoteImage";
import { resolveImage } from "@/lib/images";
import { useCities } from "@/lib/queries";
import { totalBags, useSearch } from "@/lib/search";
import type { Place } from "@/lib/search";
import { colors, radius, space } from "@/theme/tokens";

const STEPS = 3;

export default function SearchWizard() {
  const { t } = useTranslation();
  const search = useSearch();
  /*
    `step` ile belirli bir adimdan acilir; `returnTo=back` ise bitince haritaya
    degil geldigi ekrana (checkout'taki "Duzenle") doner. Checkout yeri hic
    okumaz, bu yuzden uygulama baglantisindan gelen (yer secilmemis) misafirde de
    duzenleme modudur: yer adimi gosterilmez, bitince geri doner. `returnTo=map`
    "Aramayi duzenle": yer secili, tarih adiminda acilir; yer ve valiz satirlarindan
    ilgili adima gidilir.
  */
  const params = useLocalSearchParams<{ step?: string; returnTo?: string; from?: string }>();
  const editing = params.returnTo === "back" || (params.returnTo === "map" && !!search.place);
  // Ana sayfadaki sehir kartindan gelince yer secili: dogrudan "ne zaman" adimi.
  const [step, setStep] = useState(() =>
    editing
      ? Math.min(2, Math.max(0, params.step === undefined ? 1 : Number(params.step) || 0))
      : params.from === "city" && search.place ? 1 : 0,
  );

  const [checkIn, setCheckIn] = useState(search.checkIn);
  const [checkOut, setCheckOut] = useState(search.checkOut);
  const [bags, setBags] = useState(search.bags);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<LocationFailure | null>(null);
  const cityList = useCities().data ?? [];

  function choosePlace(place: Place) {
    search.setPlace(place);
    setStep(1);
  }

  async function useMyLocation() {
    setLocating(true);
    setLocationError(null);
    const res = await getDevicePosition();
    setLocating(false);
    if (!res.ok) return setLocationError(res.reason);
    choosePlace({ label: t("map.nearYou"), ...res.position, isCurrent: true });
  }

  const windowValid = isStayWindowValid(checkIn, checkOut);

  function finish() {
    search.setWindow(checkIn, checkOut);
    search.setBags(bags);
    // `returnTo=map`: haritadan acildi, mevcut haritaya don (yeniden kurulmasin).
    if (editing || params.returnTo === "map") router.back();
    else router.replace("/map");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        {(editing ? step === 2 || (step === 0 && !!search.place) : step > 0) ? (
          <IconButton label={t("common.back")} onPress={() => setStep(editing ? 1 : step - 1)}>
            <ArrowLeft size={20} color={colors.ink} />
          </IconButton>
        ) : (
          <View style={{ width: 44 }} />
        )}
        <IconButton label={t("common.close")} onPress={() => router.back()}>
          <X size={20} color={colors.ink} />
        </IconButton>
      </View>

      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityLabel={t("search.step", { current: step + 1, total: STEPS })}
      >
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={[styles.progressPart, i <= step && styles.progressDone]} />
        ))}
      </View>

      {step === 0 ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="title">{t("search.locationTitle")}</AppText>
          <PlaceSearch onChoose={choosePlace} />
          <Pressable
            accessibilityRole="button"
            onPress={useMyLocation}
            disabled={locating}
            style={({ pressed }) => [styles.placeRow, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.placeIcon}>
              <LocateFixed size={20} color={colors.accent} />
            </View>
            <AppText variant="bodyMedium">{locating ? t("search.locating") : t("search.useLocation")}</AppText>
          </Pressable>
          {locationError ? (
            <Banner
              tone="warning"
              body={t(locationError === "denied" ? "search.locationDenied" : "search.locationUnavailable")}
            />
          ) : null}
          {cityList.length > 0 ? (
            <>
              <AppText variant="label" style={{ marginTop: space.sm, marginBottom: -space.sm }}>
                {t("search.popular")}
              </AppText>
              <View style={styles.cityList}>
                {cityList.map((c, i) => {
                  const local = CITY_IMAGES[c.name]?.source;
                  const hasRemote = !local && resolveImage(c.coverImage) != null;
                  return (
                    <Pressable
                      key={c.name}
                      accessibilityRole="button"
                      onPress={() => choosePlace({ label: c.name, latitude: c.latitude, longitude: c.longitude, radiusM: c.radiusM })}
                      style={({ pressed }) => [
                        styles.cityRow,
                        i > 0 && styles.cityDivider,
                        pressed && { backgroundColor: colors.surfaceMuted },
                      ]}
                    >
                      {local ? (
                        <Image source={local} style={styles.cityThumb} contentFit="cover" />
                      ) : hasRemote ? (
                        <RemoteImage src={c.coverImage} width={48} style={styles.cityThumb} contentFit="cover" />
                      ) : (
                        <View style={styles.cityThumb} />
                      )}
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyMedium">{c.name}</AppText>
                        <AppText variant="caption" style={{ fontSize: 13 }}>
                          {t("home.citySpots", { count: c.shopCount })}
                        </AppText>
                      </View>
                      <ChevronRight size={18} color={colors.borderStrong} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : null}

      {step === 1 ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <AppText variant="title">{t("search.whenTitle")}</AppText>
            {editing ? (
              <View style={styles.summaryRows}>
                {search.place ? (
                  <Pressable accessibilityRole="button" onPress={() => setStep(0)} style={styles.summaryRow}>
                    <AppText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                      {search.place.label}
                    </AppText>
                    <AppText variant="caption" style={{ color: colors.accent }}>
                      {t("search.changePlace")}
                    </AppText>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" onPress={() => setStep(2)} style={styles.summaryRow}>
                  <AppText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                    {t("common.bag", { count: totalBags(bags) })}
                  </AppText>
                  <AppText variant="caption" style={{ color: colors.accent }}>
                    {t("search.changePlace")}
                  </AppText>
                </Pressable>
              </View>
            ) : null}
            <AppText variant="caption">{t("search.whenHint")}</AppText>
            <StayWindowPicker
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(ci, co) => {
                setCheckIn(ci);
                setCheckOut(co);
              }}
            />
          </ScrollView>
          <View style={styles.footer}>
            <Button
              title={editing ? t("checkout.apply") : t("common.continue")}
              disabled={!windowValid}
              onPress={() => (editing ? finish() : setStep(2))}
            />
          </View>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <AppText variant="title">{t("search.bagsTitle")}</AppText>
            <BagCounter size="s" value={bags.s} onChange={(s) => setBags({ ...bags, s })} />
            <BagCounter size="m" value={bags.m} onChange={(m) => setBags({ ...bags, m })} />
            <BagCounter size="xl" value={bags.xl} onChange={(xl) => setBags({ ...bags, xl })} />
          </ScrollView>
          <View style={styles.footer}>
            <Button
              title={editing ? t("checkout.apply") : t("search.showSpots")}
              disabled={totalBags(bags) === 0}
              onPress={finish}
            />
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space.xl, paddingTop: space.sm },
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: space.xl, marginTop: space.lg },
  progressPart: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressDone: { backgroundColor: colors.brand },
  content: { padding: space.xl, gap: space.lg },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cityList: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cityRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, paddingHorizontal: space.md },
  cityThumb: { width: 40, height: 40, borderRadius: radius.inner, backgroundColor: colors.surfaceMuted },
  cityDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  summaryRows: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { padding: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
