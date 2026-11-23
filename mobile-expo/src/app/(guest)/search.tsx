import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { getDevicePosition, type LocationFailure } from "@/lib/location";
import { Image } from "expo-image";
import { ArrowLeft, ChevronRight, LocateFixed, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagCounter } from "@/components/BagCounter";
import { PlaceSearch } from "@/components/PlaceSearch";
import { StayWindowPicker, isStayWindowValid } from "@/components/StayWindowPicker";
import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { cityImage } from "@/lib/city-images";
import { RemoteImage } from "@/components/RemoteImage";
import { resolveImage } from "@/lib/images";
import { cityPlace, districtPlace, loadCityDistricts } from "@/lib/districts";
import { useCities } from "@/lib/queries";
import { totalBags, useSearch } from "@/lib/search";
import type { Place } from "@/lib/search";
import type { CityCoverage, DistrictCoverage } from "@/lib/types";
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
  const params = useLocalSearchParams<{ step?: string; returnTo?: string; from?: string; city?: string; locationError?: string }>();
  const editing = params.returnTo === "back" || (params.returnTo === "map" && !!search.place);
  /*
    Ana sayfadaki sehir kartindan gelince once ilce adimi acilir (asagidaki etki); kart
    slug gondermiyorsa (eski surum) yer secili oldugu icin dogrudan "ne zaman" adimi.
  */
  const cityFromHome = !editing && params.from === "city" ? params.city : undefined;
  const [step, setStep] = useState(() =>
    editing
      ? Math.min(2, Math.max(0, params.step === undefined ? 1 : Number(params.step) || 0))
      : params.from === "city" && search.place && !cityFromHome ? 1 : 0,
  );

  const [checkIn, setCheckIn] = useState(search.checkIn);
  const [checkOut, setCheckOut] = useState(search.checkOut);
  const [bags, setBags] = useState(search.bags);
  const [locating, setLocating] = useState(false);
  // "blocked": izin kalici reddedildi, sistem penceresi acilmaz; yalnizca Ayarlar yolu kalir.
  const [locationError, setLocationError] = useState<LocationFailure | "blocked" | null>(() =>
    params.locationError === "blocked" || params.locationError === "denied" || params.locationError === "unavailable"
      ? params.locationError
      : null,
  );
  const cityList = useCities().data ?? [];
  const queryClient = useQueryClient();
  /*
    Sehirden sonra ilce adimi: ilk satir "Merkez" (bugunku sehir secimi), altinda dukkani
    olan ilceler. Liste bos gelirse ya da uc yoksa (eski sunucu) adim hic acilmaz.
  */
  const [districtStep, setDistrictStep] = useState<{ city: CityCoverage; districts: DistrictCoverage[] } | null>(null);
  const [loadingCity, setLoadingCity] = useState<string | null>(null);
  /*
    Bekleyen ilce isteginin kimligi. Yuklenirken misafir adres ya da konum secebilir,
    baska sehre dokunabilir: gec gelen yanit o secimi ezmesin, yalnizca son istek gecer.
  */
  const pendingCity = useRef(0);

  function cancelPendingCity() {
    pendingCity.current += 1;
    setLoadingCity(null);
  }

  function choosePlace(place: Place) {
    cancelPendingCity();
    setDistrictStep(null);
    search.setPlace(place);
    setStep(1);
  }

  async function chooseCity(city: CityCoverage) {
    const id = ++pendingCity.current;
    setLoadingCity(city.name);
    const districts = await loadCityDistricts(queryClient, city);
    if (id !== pendingCity.current) return;
    setLoadingCity(null);
    if (districts.length > 0) setDistrictStep({ city, districts });
    else choosePlace(cityPlace(city));
  }

  /*
    Sehir kartindan gelindiyse sehir listesinde dokunulmus gibi ilce adimini ac: kart
    dogrudan tarihe atliyordu ve ilce secimi hic gorunmuyordu (2026-11-23).
  */
  const openedFromHome = useRef(false);
  useEffect(() => {
    if (!cityFromHome || openedFromHome.current || cityList.length === 0) return;
    const city = cityList.find((c) => (c.slug ?? c.name) === cityFromHome);
    // Listede yoksa (kart eski veriyle) sehir listesi acik kalir; misafir oradan secer.
    if (!city) return;
    // Bir sonraki tikte: etkinin icinden senkron setState zincirleme render tetikler.
    const timer = setTimeout(() => {
      openedFromHome.current = true;
      void chooseCity(city);
    }, 0);
    return () => clearTimeout(timer);
    // chooseCity her render'da yeniden tanimlaniyor; yalnizca liste gelince bir kez calisir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFromHome, cityList.length]);

  // Android geri tusu ilce adimindan sihirbazi kapatmasin, sehir listesine donsun.
  useEffect(() => {
    if (!districtStep) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setDistrictStep(null);
      return true;
    });
    return () => sub.remove();
  }, [districtStep]);

  async function useMyLocation() {
    cancelPendingCity();
    setLocating(true);
    setLocationError(null);
    const res = await getDevicePosition();
    setLocating(false);
    if (!res.ok) return setLocationError(res.reason === "denied" && !res.canAskAgain ? "blocked" : res.reason);
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
        {districtStep && step === 0 ? (
          <IconButton label={t("common.back")} onPress={() => setDistrictStep(null)}>
            <ArrowLeft size={20} color={colors.ink} />
          </IconButton>
        ) : (editing ? step === 2 || (step === 0 && !!search.place) : step > 0) ? (
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

      {step === 0 && districtStep ? (
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="title">{t("search.districtTitle", { city: districtStep.city.name })}</AppText>
          <View style={styles.cityList}>
            <Pressable
              accessibilityRole="button"
              onPress={() => choosePlace(cityPlace(districtStep.city))}
              style={({ pressed }) => [styles.cityRow, pressed && { backgroundColor: colors.surfaceMuted }]}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium">{t("search.cityCenter")}</AppText>
                <AppText variant="caption" style={{ fontSize: 13 }}>
                  {t("search.cityCenterHint")}
                </AppText>
              </View>
              <ChevronRight size={18} color={colors.borderStrong} />
            </Pressable>
            {districtStep.districts.map((d) => (
              <Pressable
                key={d.slug}
                accessibilityRole="button"
                accessibilityLabel={`${d.name}, ${t("home.citySpots", { count: d.shopCount })}`}
                onPress={() => choosePlace(districtPlace(d, districtStep.city))}
                style={({ pressed }) => [
                  styles.cityRow,
                  styles.cityDivider,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{d.name}</AppText>
                  <AppText variant="caption" style={{ fontSize: 13 }}>
                    {t("home.citySpots", { count: d.shopCount })}
                  </AppText>
                </View>
                <ChevronRight size={18} color={colors.borderStrong} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {step === 0 && !districtStep ? (
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
            <>
              <Banner
                tone="warning"
                body={t(
                  locationError === "blocked"
                    ? "search.locationBlocked"
                    : locationError === "denied"
                      ? "search.locationDenied"
                      : "search.locationUnavailable",
                )}
              />
              {locationError === "blocked" ? (
                <Button
                  variant="secondary"
                  title={t("search.openSettings")}
                  onPress={() => void Linking.openSettings().catch(() => undefined)}
                />
              ) : null}
            </>
          ) : null}
          {cityList.length > 0 ? (
            <>
              <AppText variant="label" style={{ marginTop: space.sm, marginBottom: -space.sm }}>
                {t("search.popular")}
              </AppText>
              <View style={styles.cityList}>
                {cityList.map((c, i) => {
                  const local = cityImage(c)?.source;
                  const hasRemote = !local && resolveImage(c.coverImage) != null;
                  return (
                    <Pressable
                      key={c.name}
                      accessibilityRole="button"
                      accessibilityState={{ busy: loadingCity === c.name }}
                      onPress={() => void chooseCity(c)}
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
                      {loadingCity === c.name ? (
                        <ActivityIndicator color={colors.accent} accessibilityLabel={t("search.districtsLoading")} />
                      ) : (
                        <ChevronRight size={18} color={colors.borderStrong} />
                      )}
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
                {params.returnTo === "map" && search.place ? (
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
