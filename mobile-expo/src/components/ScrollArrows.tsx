import { useCallback, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, radius } from "@/theme/tokens";
import { flipInRtl } from "@/lib/rtl";

/**
 * Yatay seritler (saat secimi, sehir kartlari) kaydirilabildigi her zaman anlasilmiyordu.
 * Kaydirma yine calisir; oklar bir ekran genisliginin ~%80'i kadar atlatir. Uca gelince
 * o yondeki ok soner, serit sigiyorsa hic gosterilmez.
 */
export function useScrollArrows(ref: RefObject<ScrollView | null>) {
  const [x, setX] = useState(0);
  const [viewW, setViewW] = useState(0);
  const [contentW, setContentW] = useState(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setX(e.nativeEvent.contentOffset.x), []);
  const onLayout = useCallback((e: LayoutChangeEvent) => setViewW(e.nativeEvent.layout.width), []);
  const onContentSizeChange = useCallback((w: number) => setContentW(w), []);

  const max = Math.max(0, contentW - viewW);
  const page = (dir: -1 | 1) => {
    const to = Math.min(max, Math.max(0, x + dir * viewW * 0.8));
    ref.current?.scrollTo({ x: to, animated: true });
  };

  return {
    scrollProps: { onScroll, onLayout, onContentSizeChange, scrollEventThrottle: 32 },
    overflow: max > 1,
    canBack: x > 1,
    canForward: x < max - 1,
    page,
  };
}

export function ScrollArrows({ state }: { state: ReturnType<typeof useScrollArrows> }) {
  const { t } = useTranslation();
  if (!state.overflow) return null;
  return (
    <View style={styles.row}>
      <Arrow label={t("common.scrollBack")} enabled={state.canBack} onPress={() => state.page(-1)}>
        <ChevronLeft size={16} color={state.canBack ? colors.ink : colors.borderStrong} style={flipInRtl} />
      </Arrow>
      <Arrow label={t("common.scrollForward")} enabled={state.canForward} onPress={() => state.page(1)}>
        <ChevronRight size={16} color={state.canForward ? colors.ink : colors.borderStrong} style={flipInRtl} />
      </Arrow>
    </View>
  );
}

function Arrow({
  label,
  enabled,
  onPress,
  children,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
