import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { ArrowLeft, LocateFixed, MapPin, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagCounter } from "@/components/BagCounter";
import { RangeCalendar } from "@/components/Calendar";
import { AppText, Banner, Button, Chip, IconButton } from "@/components/ui";
import { formatDay } from "@/lib/format";
import { CITIES, totalBags, useSearch } from "@/lib/search";
import { atWallMinutes as withMinutes, cellOf, fromCell, sameWallDay, wallMinutes as minutesOf } from "@/lib/time";
import type { Place } from "@/lib/search";
import { colors, radius, space } from "@/theme/tokens";

const STEPS = 3;
const HOUR = 3600_000;

/** 00:00-23:30 arasi yarim saatlik secenekler, dakika cinsinden. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);
const CHIP_WIDTH = 80;
const CHIP_GAP = 8;


function label(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

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

  const now = Date.now();
  const sameDay = sameWallDay(checkIn, checkOut);
  const windowValid = checkIn.getTime() >= now - 5 * 60_000 && checkOut.getTime() - checkIn.getTime() >= HOUR;

  function setDropMinutes(m: number) {
    const ci = withMinutes(checkIn, m);
    setCheckIn(ci);
    // Ayni gunde alma saati bir saatten yakin kaldiysa ileri it.
    if (checkOut.getTime() - ci.getTime() < HOUR) setCheckOut(new Date(ci.getTime() + 4 * HOUR));
  }

  /** `start`/`end` takvim hucresi (bkz. `cellOf`); anlara Istanbul saatiyle donulur. */
  function setRange(start: Date, end: Date) {
    const ci = fromCell(start, minutesOf(checkIn));
    let co = fromCell(end, minutesOf(checkOut));
    if (co.getTime() - ci.getTime() < HOUR) co = new Date(ci.getTime() + 4 * HOUR);
    setCheckIn(ci);
    setCheckOut(co);
  }

  function finish() {
    search.setWindow(checkIn, checkOut);
    search.setBags(bags);
    if (editing) router.back();
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
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="title">{t("search.locationTitle")}</AppText>
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
            <RangeCalendar start={cellOf(checkIn)} end={cellOf(checkOut)} onChange={setRange} />

            <TimeRow
              title={`${t("search.dropOff")} · ${formatDay(checkIn)}`}
              selected={minutesOf(checkIn)}
              isDisabled={(m) => withMinutes(checkIn, m).getTime() < now}
              onSelect={setDropMinutes}
            />
            <TimeRow
              title={`${t("search.pickUp")} · ${formatDay(checkOut)}`}
              selected={minutesOf(checkOut)}
              isDisabled={(m) => withMinutes(checkOut, m).getTime() - checkIn.getTime() < HOUR}
              onSelect={(m) => setCheckOut(withMinutes(checkOut, m))}
            />
            {!windowValid && sameDay ? <Banner tone="warning" body={t("search.pickUpBeforeDropOff")} /> : null}
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

function TimeRow({
  title,
  selected,
  isDisabled,
  onSelect,
}: {
  title: string;
  selected: number;
  isDisabled: (m: number) => boolean;
  onSelect: (m: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  // Secili saat ekranin solunda ikinci sirada dursun; ilk acilista da gorunsun.
  useEffect(() => {
    const idx = Math.max(0, TIME_OPTIONS.indexOf(selected) - 1);
    ref.current?.scrollTo({ x: idx * (CHIP_WIDTH + CHIP_GAP), animated: false });
  }, [selected]);

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{title}</AppText>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: CHIP_GAP }}
      >
        {TIME_OPTIONS.map((m) => (
          <View key={m} style={{ width: CHIP_WIDTH }}>
            <Chip label={label(m)} selected={m === selected} disabled={isDisabled(m)} onPress={() => onSelect(m)} />
          </View>
        ))}
      </ScrollView>
    </View>
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
