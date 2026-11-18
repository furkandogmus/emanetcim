import { StyleSheet, View } from "react-native";

import { colors, radius, space } from "@/theme/tokens";

/**
 * Liste yuklenirken BookingRow biciminde yer tutucu: ortada donen simge yerine sayfanin
 * iskeleti hemen cizilir, veri gelince satirlar yerinden oynamaz.
 */
export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.tile} />
          <View style={{ flex: 1, gap: space.sm }}>
            <View style={[styles.bar, { width: "60%", height: 16 }]} />
            <View style={[styles.bar, { width: "85%" }]} />
            <View style={[styles.bar, { width: 88, height: 22, borderRadius: radius.pill }]} />
          </View>
          <View style={[styles.bar, { width: 44, height: 16 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tile: { width: 52, height: 56, borderRadius: radius.inner + 2, backgroundColor: colors.surfaceMuted },
  bar: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceMuted },
});
