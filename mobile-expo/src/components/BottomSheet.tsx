import { StyleSheet, View, useWindowDimensions } from "react-native";
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
  top,
  peek,
}: {
  children: ReactNode;
  top: number;
  peek: number;
}) {
  const { height } = useWindowDimensions();
  const open = top;
  const closed = height - peek;
  const y = useSharedValue(closed);
  const start = useSharedValue(closed);

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

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[styles.sheet, { height: height - open }, style]}>
      <GestureDetector gesture={pan}>
        <View style={styles.handleArea} accessibilityRole="adjustable">
          <View style={styles.handle} />
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
