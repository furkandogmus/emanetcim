import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { colors, radius, shadow } from "@/theme/tokens";

const SPRING = { damping: 22, stiffness: 220, mass: 0.9 };

/**
 * Haritanin uzerinde iki konumlu cekilebilir panel: asagida baslik gorunur,
 * yukarida liste acilir. Kutuphane yerine ~60 satir: @gorhom/bottom-sheet
 * Expo Go listesinde degil ve reanimated 4 ile surum uyumu her SDK'da yeniden
 * dogrulanmak zorunda.
 *
 * `top` ekranin ustunden acik konumdaki mesafe, `peek` kapali konumda gorunen
 * yukseklik.
 */
export function BottomSheet({
  children,
  header,
  handleLabel,
  top,
  peek,
  initialOpen,
}: {
  children: ReactNode;
  /** Tutamacla birlikte surulebilir baslik: kapali konumda gorunen sert serit hep surukler. */
  header?: ReactNode;
  handleLabel?: string;
  top: number;
  peek: number;
  /** true: panel acik baslar (bos durum mesaji kapali konumda gorunmesin diye). Degisince `key` ile yeniden kurulur. */
  initialOpen?: boolean;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const open = top;
  const closed = height - peek;
  const y = useSharedValue(initialOpen ? open : closed);
  const start = useSharedValue(initialOpen ? open : closed);

  // Surukleme kesfedilmese de tutamaca dokunmak paneli acar/kapatir.
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) y.value = withSpring(y.value > (open + closed) / 2 ? open : closed, SPRING);
  });

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = y.value;
    })
    .onUpdate((e) => {
      y.value = Math.min(closed, Math.max(open, start.value + e.translationY));
    })
    .onEnd((e) => {
      const goingUp = e.velocityY < -300 || (e.velocityY < 300 && y.value < (open + closed) / 2);
      y.value = withSpring(goingUp ? open : closed, SPRING);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[styles.sheet, { height: height - open }, style]}>
      <GestureDetector gesture={gesture}>
        <View collapsable={false}>
          <View
            style={styles.handleArea}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={handleLabel ?? t("map.toggleList")}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => {
              // Ekran okuyucuda surukleme yok: artir = paneli ac, azalt = kapat.
              y.set(withSpring(e.nativeEvent.actionName === "increment" ? open : closed, SPRING));
            }}
          >
            <View style={styles.handle} />
          </View>
          {header}
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...shadow.floating,
  },
  handleArea: { alignItems: "center", paddingVertical: 12 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
});
