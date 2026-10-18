import { useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { RangeCalendar } from "@/components/Calendar";
import { AppText, Banner, Chip } from "@/components/ui";
import { formatDay } from "@/lib/format";
import { atWallMinutes as withMinutes, cellOf, fromCell, sameWallDay, wallMinutes as minutesOf } from "@/lib/time";
import { space } from "@/theme/tokens";

const HOUR = 3600_000;
/** Sunucu `maxStayDays` (varsayilan 30) ile ayni; gun sayisi yukari yuvarlanir. */
const MAX_STAY_MS = 30 * 24 * HOUR;

/** 00:00-23:30 arasi yarim saatlik secenekler, dakika cinsinden. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);
const CHIP_WIDTH = 80;
const CHIP_GAP = 8;

function label(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Sunucunun `validateBookingStayWindow` kurali: gecmiste baslamaz, en az 1 saat, en cok 30 gun. */
export function isStayWindowValid(checkIn: Date, checkOut: Date, now = Date.now()) {
  const span = checkOut.getTime() - checkIn.getTime();
  return checkIn.getTime() >= now - 5 * 60_000 && span >= HOUR && span <= MAX_STAY_MS;
}

/**
 * Takvim + birakma/alma saat seridi. Arama sihirbazi ve rezervasyon degistirme
 * ayni secicinin iki kullanicisi: Istanbul duvar saati kurali tek yerde kalsin.
 */
export function StayWindowPicker({
  checkIn,
  checkOut,
  onChange,
}: {
  checkIn: Date;
  checkOut: Date;
  onChange: (checkIn: Date, checkOut: Date) => void;
}) {
  const { t } = useTranslation();
  const now = Date.now();
  const windowValid = isStayWindowValid(checkIn, checkOut, now);

  function setDropMinutes(m: number) {
    const ci = withMinutes(checkIn, m);
    // Ayni gunde alma saati bir saatten yakin kaldiysa ileri it.
    onChange(ci, checkOut.getTime() - ci.getTime() < HOUR ? new Date(ci.getTime() + 4 * HOUR) : checkOut);
  }

  /** `start`/`end` takvim hucresi (bkz. `cellOf`); anlara Istanbul saatiyle donulur. */
  function setRange(start: Date, end: Date) {
    const ci = fromCell(start, minutesOf(checkIn));
    let co = fromCell(end, minutesOf(checkOut));
    if (co.getTime() - ci.getTime() < HOUR) co = new Date(ci.getTime() + 4 * HOUR);
    // 30. gunde alma saati birakmadan gec olursa sure 31 gune yuvarlanip reddediliyordu.
    if (co.getTime() - ci.getTime() > MAX_STAY_MS) co = new Date(ci.getTime() + MAX_STAY_MS);
    onChange(ci, co);
  }

  return (
    <>
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
        isDisabled={(m) => {
          const d = withMinutes(checkOut, m).getTime() - checkIn.getTime();
          return d < HOUR || d > MAX_STAY_MS;
        }}
        onSelect={(m) => onChange(checkIn, withMinutes(checkOut, m))}
      />
      {/* Gecmis birakma saati de pencereyi gecersiz kilar; uyari gercek nedeni soyler. */}
      {checkIn.getTime() < now - 5 * 60_000 ? (
        <Banner tone="warning" body={t("search.dropOffInPast")} />
      ) : !windowValid && sameWallDay(checkIn, checkOut) ? (
        <Banner tone="warning" body={t("search.pickUpBeforeDropOff")} />
      ) : null}
    </>
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
