import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { ArrowLeft, LocateFixed, MapPin, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagCounter } from "@/components/BagCounter";
import { PlaceSearch } from "@/components/PlaceSearch";
import { StayWindowPicker, isStayWindowValid } from "@/components/StayWindowPicker";
import { AppText, Banner, Button, IconButton } from "@/components/ui";
import { CITIES, totalBags, useSearch } from "@/lib/search";
import type { Place } from "@/lib/search";
import { colors, radius, space } from "@/theme/tokens";

const STEPS = 3;

export default function SearchWizard() {
  const { t } = useTranslation();
  const search = useSearch();
  /*
    `step` ile belirli bir adimdan acilir; `returnTo=back` ise bitince haritaya
    degil geldigi ekrana (checkout'taki "Duzenle") doner. Yer zaten secilmis
    olmali; secili degilse ilk adimdan baslanir.
  */
  const params = useLocalSearchParams<{ step?: string; returnTo?: string }>();
  const editing = params.returnTo === "back" && !!search.place;
  const [step, setStep] = useState(() => (editing ? Math.min(2, Math.max(0, Number(params.step) || 0)) : 0));

  const [checkIn, setCheckIn] = useState(search.checkIn);
  const [checkOut, setCheckOut] = useState(search.checkOut);
  const [bags, setBags] = useState(search.bags);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  function choosePlace(place: Place) {
    search.setPlace(place);
    setStep(1);
  }

  async function useMyLocation() {
    setLocating(true);
    setLocationError(false);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setLocationError(true);
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      choosePlace({
        label: t("map.nearYou"),
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        isCurrent: true,
      });
    } catch {
      setLocationError(true);
    } finally {
      setLocating(false);
    }
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
        {step > 0 && !editing ? (
          <IconButton label={t("common.back")} onPress={() => setStep(step - 1)}>
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
          {locationError ? <Banner tone="warning" body={t("search.locationDenied")} /> : null}
          <AppText variant="label" style={{ marginTop: space.md }}>
            {t("search.popular")}
          </AppText>
          {CITIES.map((c) => (
            <Pressable
              key={c.label}
              accessibilityRole="button"
              onPress={() => choosePlace(c)}
              style={({ pressed }) => [styles.placeRow, pressed && { opacity: 0.7 }]}
            >
              <MapPin size={20} color={colors.inkMuted} style={{ marginHorizontal: 12 }} />
              <AppText variant="bodyMedium">{c.label}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {step === 1 ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <AppText variant="title">{t("search.whenTitle")}</AppText>
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
  progressPart: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
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
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { padding: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
