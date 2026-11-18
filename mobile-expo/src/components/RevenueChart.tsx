import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { colors, fonts, space } from "@/theme/tokens";
import { languageInfo } from "@/lib/languages";

type Point = { date: string; revenue: number; bookings: number };

const HEIGHT = 112;
/** Gri sutunlar; vurgu yalnizca secili gunde (varsayilan bugun). */
const BAR = "#A8A29E";
const STUB = 2;

/**
 * Tek seri gunluk ciro. Sutun ince, taban cizgisine oturur, ust ucu 4px yuvarlak.
 * Gri sutunun yuzeye karsiti 3:1'in altinda: secili gunun degeri her zaman metin
 * olarak ustte yazar, renk tek basina bilgi tasimaz.
 */
export function RevenueChart({ series }: { series: Point[] }) {
  const { t, i18n } = useTranslation();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(series.length - 1);
  const max = Math.max(1, ...series.map((p) => p.revenue));
  const slot = width / Math.max(1, series.length);
  const barW = Math.max(4, Math.min(14, slot - 4));
  const sel = series[selected];

  const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(languageInfo(i18n.language).intl, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  // Hic odenmis gun yoksa bos bir eksen yer kaplamasin: tek satir yeter.
  if (series.every((p) => p.revenue === 0)) {
    return (
      <View style={styles.empty}>
        <AppText variant="caption" style={{ fontSize: 13 }}>
          {t("admin.chartEmpty")}
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="caption" style={{ fontSize: 13 }} accessibilityLiveRegion="polite">
        {sel
          ? `${selected === series.length - 1 ? t("admin.chartToday") : dayLabel(sel.date)} · ${formatMoney(sel.revenue)} · ${t("admin.bookingsCount", { count: sel.bookings })}`
          : ""}
      </AppText>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={colors.border} strokeWidth={1} />
            {series.map((p, i) => {
              const h = p.revenue > 0 ? Math.max(4, (p.revenue / max) * (HEIGHT - 8)) : STUB;
              const x = i * slot + (slot - barW) / 2;
              const active = i === selected;
              return (
                <Rect
                  key={p.date}
                  x={x}
                  y={HEIGHT - h}
                  width={barW}
                  height={h}
                  rx={p.revenue > 0 ? Math.min(4, barW / 2) : 1}
                  fill={active ? colors.accent : p.revenue > 0 ? BAR : colors.border}
                />
              );
            })}
          </Svg>
        ) : null}
        {/* Dokunma hedefi sutundan genis: tum dilim. */}
        <View style={StyleSheet.absoluteFill} accessibilityElementsHidden>
          <View style={{ flexDirection: "row", flex: 1 }}>
            {series.map((p, i) => (
              <Pressable key={p.date} style={{ flex: 1 }} onPress={() => setSelected(i)} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.axis}>
        <AppText style={styles.axisText}>
          {series[0] ? `${dayLabel(series[0].date)} · ${t("admin.last14")}` : ""}
        </AppText>
        <AppText style={styles.axisText}>{t("admin.chartToday")}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, fontVariant: ["tabular-nums"] },
  empty: { paddingVertical: space.lg, alignItems: "center", borderRadius: 12, backgroundColor: colors.surfaceMuted },
});
