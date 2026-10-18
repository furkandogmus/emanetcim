import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { IconButton } from "@/components/ui";
import { formatMonth } from "@/lib/format";
import { nextRange, type Picking } from "@/lib/date-range";
import { cellOf } from "@/lib/time";
import { colors, fonts, radius, space } from "@/theme/tokens";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Pazartesi baslangicli ay izgarasi; bos hucreler null. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * Tarih araligi secici. Ilk dokunus baslangic, ikinci dokunus bitis; tek
 * dokunus "ayni gun" demek. Kural `nextRange`te.
 */
export function RangeCalendar({
  start,
  end,
  onChange,
  maxDays = 30,
}: {
  start: Date;
  end: Date;
  onChange: (start: Date, end: Date) => void;
  maxDays?: number;
}) {
  const { t, i18n } = useTranslation();
  // Hucreler Istanbul gunleri; "bugun" de oyle (gece yarisi farki telefonda olmasin).
  const today = cellOf(new Date());
  const [month, setMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));
  const [picking, setPicking] = useState<Picking>("start");
  const cells = useMemo(() => monthGrid(month), [month]);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language === "tr" ? "tr-TR" : "en-GB", { weekday: "narrow" });
    // 2024-01-01 bir pazartesi.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [i18n.language]);

  const canGoBack = month > new Date(today.getFullYear(), today.getMonth(), 1);

  function pick(day: Date) {
    const next = nextRange(start, end, day, picking, maxDays);
    onChange(next.start, next.end);
    setPicking(next.picking);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <IconButton
          label={t("search.prevMonth")}
          onPress={() => canGoBack && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          style={!canGoBack && { opacity: 0.3 }}
        >
          <ChevronLeft size={20} color={colors.ink} />
        </IconButton>
        <Text style={styles.month}>{formatMonth(month)}</Text>
        <IconButton
          label={t("search.nextMonth")}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          <ChevronRight size={20} color={colors.ink} />
        </IconButton>
      </View>

      <View style={styles.row}>
        {weekdayLabels.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />;
          const past = day < today;
          const isStart = sameDay(day, start);
          const isEnd = sameDay(day, end);
          const inRange = day > startOfDay(start) && day < startOfDay(end);
          return (
            <Pressable
              key={i}
              disabled={past}
              onPress={() => pick(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isStart || isEnd, disabled: past }}
              style={[styles.cell, inRange && styles.inRange]}
            >
              <View style={[styles.dayDot, (isStart || isEnd) && styles.selected]}>
                <Text
                  style={[
                    styles.dayText,
                    past && { color: colors.borderStrong },
                    (isStart || isEnd) && { color: colors.white, fontFamily: fonts.bodySemibold },
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  month: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink, textTransform: "capitalize" },
  row: { flexDirection: "row" },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkMuted,
    paddingVertical: space.sm,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" },
  inRange: { backgroundColor: colors.brandSoft },
  dayDot: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: colors.accent },
  dayText: { fontFamily: fonts.body, fontSize: 16, color: colors.ink },
});
