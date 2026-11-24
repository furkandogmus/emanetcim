import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { AppText, Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { languageInfo } from "@/lib/languages";
import { busiestHour } from "@/lib/partner-parity";
import type { PartnerEarningsInsights } from "@/lib/types";
import { colors, fonts, space } from "@/theme/tokens";

/** `RevenueChart` ile ayni dil: ince gri sutun, tek vurgu, renk tek basina bilgi tasimaz. */
const BAR = "#A8A29E";
const HEIGHT = 96;

type Bar = { key: string; value: number; a11y: string };

function BarChart({
  bars,
  accentIndex,
  selected,
  onSelect,
}: {
  bars: Bar[];
  accentIndex: number | null;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = width / Math.max(1, bars.length);
  const barW = Math.max(3, Math.min(14, slot - 4));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {/* Soluk izgara: yarim ve tepe; taban cizgisi daha koyu. */}
          {[0.5, 1].map((f) => (
            <Line key={f} x1={0} x2={width} y1={HEIGHT - f * (HEIGHT - 8)} y2={HEIGHT - f * (HEIGHT - 8)} stroke={colors.surfaceMuted} strokeWidth={1} />
          ))}
          <Line x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={colors.border} strokeWidth={1} />
          {bars.map((b, i) => {
            const h = b.value > 0 ? Math.max(4, (b.value / max) * (HEIGHT - 8)) : 2;
            const accent = i === selected || (selected < 0 && i === accentIndex);
            return (
              <Rect
                key={b.key}
                x={i * slot + (slot - barW) / 2}
                y={HEIGHT - h}
                width={barW}
                height={h}
                rx={b.value > 0 ? Math.min(3, barW / 2) : 1}
                fill={accent ? colors.accent : b.value > 0 ? BAR : colors.border}
              />
            );
          })}
        </Svg>
      ) : null}
      {/* Dokunma hedefi sutundan genis: tum dilim. */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
        {bars.map((b, i) => (
          <Pressable
            key={b.key}
            style={{ flex: 1 }}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={b.a11y}
            accessibilityState={{ selected: i === selected }}
          />
        ))}
      </View>
    </View>
  );
}

export function PartnerInsightCharts({ insights }: { insights: PartnerEarningsInsights }) {
  const { t, i18n } = useTranslation();
  const intl = languageInfo(i18n.language).intl;
  const months = insights.months;
  const [month, setMonth] = useState(months.length - 1);
  const peak = busiestHour(insights.peakHours);
  const [hour, setHour] = useState<number>(-1);

  const monthName = (key: string, style: "short" | "long" = "long") =>
    new Date(`${key}-15T12:00:00Z`).toLocaleDateString(intl, { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" });

  const selMonth = months[month];
  const shownHour = hour >= 0 ? hour : peak;
  const selHour = shownHour !== null ? insights.peakHours[shownHour] : null;
  const hasHours = peak !== null;

  return (
    <View style={{ gap: space.lg }}>
      <Card style={styles.card}>
        <AppText variant="label">{t("partnerParity.monthlyTitle")}</AppText>
        <AppText style={styles.readout} accessibilityLiveRegion="polite">
          {selMonth
            ? t("partnerParity.monthReadout", {
                month: monthName(selMonth.month),
                amount: formatMoney(selMonth.net),
                handovers: t("partnerParity.handovers", { count: selMonth.count }),
              })
            : ""}
        </AppText>
        <BarChart
          bars={months.map((m) => ({
            key: m.month,
            value: m.net,
            a11y: t("partnerParity.monthReadout", {
              month: monthName(m.month),
              amount: formatMoney(m.net),
              handovers: t("partnerParity.handovers", { count: m.count }),
            }),
          }))}
          accentIndex={months.length - 1}
          selected={month}
          onSelect={setMonth}
        />
        <View style={styles.axis}>
          {months.map((m) => (
            <AppText key={m.month} style={[styles.axisText, { flex: 1, textAlign: "center" }]}>
              {monthName(m.month, "short")}
            </AppText>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="label">{t("partnerParity.peakTitle")}</AppText>
        {hasHours && selHour ? (
          <>
            <AppText style={styles.readout} accessibilityLiveRegion="polite">
              {t(shownHour === peak ? "partnerParity.peakReadoutBusiest" : "partnerParity.peakReadout", {
                hour: selHour.hour,
                dropoffs: t("partnerParity.dropoffs", { count: selHour.count }),
              })}
            </AppText>
            <BarChart
              bars={insights.peakHours.map((h) => ({
                key: h.hour,
                value: h.count,
                a11y: t("partnerParity.peakReadout", { hour: h.hour, dropoffs: t("partnerParity.dropoffs", { count: h.count }) }),
              }))}
              accentIndex={peak}
              selected={hour >= 0 ? hour : -1}
              onSelect={setHour}
            />
            <View style={styles.axis}>
              {["00", "06", "12", "18", "23"].map((h) => (
                <AppText key={h} style={styles.axisText}>
                  {h}
                </AppText>
              ))}
            </View>
          </>
        ) : (
          <AppText variant="caption">{t("partnerParity.peakEmpty")}</AppText>
        )}
      </Card>

      <View style={styles.stats}>
        <Stat label={t("partnerParity.avgStay")} value={t("partnerParity.hours", { count: insights.avgStayHours })} />
        <Stat label={t("partnerParity.conversion")} value={t("partnerParity.percent", { value: insights.conversionPct })} />
        <Stat
          label={t("partnerParity.rating")}
          value={insights.avgRating !== null ? insights.avgRating.toLocaleString(intl, { minimumFractionDigits: 1 }) : "-"}
        />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText variant="caption" numberOfLines={2}>
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  readout: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSecondary, fontVariant: ["tabular-nums"] },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, gap: space.xs },
  statValue: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.ink, fontVariant: ["tabular-nums"] },
});
