import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { formatCount } from "@/lib/format";
import { colors, fonts, space } from "@/theme/tokens";

/** RevenueChart ile ayni gri; vurgu yalniz `accentIndex` satirinda. */
const BAR = "#A8A29E";

export type BarItem = { key: string; label: string; value: number; caption?: string };

/**
 * Yatay ince cubuk listesi (en cok gorulen sayfa/dukkan, sehir talebi, huni).
 * Iz soluk zemin, cubuk gri, tek vurgu. Deger her satirda metin olarak yazar: renk
 * tek basina bilgi tasimaz. `max` verilmezse en buyuk deger olcek olur.
 */
export function BarList({
  items,
  max,
  accentIndex = 0,
  format = formatCount,
}: {
  items: BarItem[];
  max?: number;
  accentIndex?: number | null;
  format?: (n: number) => string;
}) {
  const scale = Math.max(1, max ?? Math.max(0, ...items.map((i) => i.value)));
  return (
    <View style={{ gap: space.md }}>
      {items.map((item, i) => {
        const pct = Math.max(0, Math.min(1, item.value / scale));
        return (
          <View key={item.key} style={{ gap: 4 }} accessible accessibilityLabel={`${item.label}: ${format(item.value)}`}>
            <View style={styles.head}>
              <AppText variant="caption" numberOfLines={1} style={styles.label}>
                {item.label}
              </AppText>
              <AppText variant="caption" style={styles.value}>
                {format(item.value)}
              </AppText>
            </View>
            <View style={styles.track}>
              {item.value > 0 ? (
                <View
                  style={[
                    styles.bar,
                    { width: `${Math.max(2, pct * 100)}%`, backgroundColor: i === accentIndex ? colors.accent : BAR },
                  ]}
                />
              ) : null}
            </View>
            {item.caption ? (
              <AppText variant="caption" style={{ fontSize: 12 }} numberOfLines={1}>
                {item.caption}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  label: { flex: 1, color: colors.ink, fontSize: 13 },
  value: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3 },
});
