import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import type { FlatListProps } from "react-native";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { NativeGesture } from "react-native-gesture-handler";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { AnimatedRef, SharedValue } from "react-native-reanimated";

import { colors, radius, shadow } from "@/theme/tokens";

const SPRING = { damping: 22, stiffness: 220, mass: 0.9 };

type SheetList = {
  ref: AnimatedRef<Animated.FlatList<unknown>>;
  scrollY: SharedValue<number>;
  native: NativeGesture;
};

const SheetListContext = createContext<SheetList | null>(null);

/**
 * Haritanin uzerinde iki konumlu cekilebilir panel: asagida baslik gorunur,
 * yukarida liste acilir. Kutuphane yerine kucuk bir bilesen: @gorhom/bottom-sheet
 * Expo Go listesinde degil ve reanimated 4 ile surum uyumu her SDK'da yeniden
 * dogrulanmak zorunda.
 *
 * Panel her yerinden surukler (eskiden yalnizca tutamak seridi): panel tam acik
 * degilken parmak paneli tasir ve liste yerinde tutulur; tam acikken liste
 * kayar, liste en ustteyken asagi cekmek paneli kapatir. Liste icin
 * `SheetFlatList` kullanilir; o olmadan icerik yine her yerinden surukler.
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
  /** Tutamacla birlikte dokununca acip kapatan baslik. */
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
  const lastT = useSharedValue(0);
  const movedSheet = useSharedValue(false);
  const heldScroll = useSharedValue(0);

  const listRef = useAnimatedRef<Animated.FlatList<unknown>>();
  const scrollY = useSharedValue(0);
  const native = useMemo(() => Gesture.Native(), []);

  // Surukleme kesfedilmese de tutamaca/basliga dokunmak paneli acar/kapatir.
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) y.value = withSpring(y.value > (open + closed) / 2 ? open : closed, SPRING);
  });

  const pan = Gesture.Pan()
    // Dikey niyet netlesmeden almaz: karttaki dokunma ve yatay kaydirma bozulmasin.
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .simultaneousWithExternalGesture(native)
    .onBegin(() => {
      lastT.value = 0;
      movedSheet.value = false;
      heldScroll.value = scrollY.value;
    })
    .onUpdate((e) => {
      const dy = e.translationY - lastT.value;
      lastT.value = e.translationY;
      const fullyOpen = y.value <= open + 0.5;
      // Tam acikken liste kendi kayar; yalnizca liste en ustte ve asagi cekiliyorsa panel iner.
      if (fullyOpen && !(dy > 0 && scrollY.value <= 0)) {
        heldScroll.value = scrollY.value;
        return;
      }
      movedSheet.value = true;
      y.value = Math.min(closed, Math.max(open, y.value + dy));
      // Panel tasinirken liste ayni anda kaymasin: oldugu yerde tutulur (UI ipliginde).
      scrollTo(listRef, 0, heldScroll.value, false);
    })
    .onEnd((e) => {
      if (!movedSheet.value) return;
      const goingUp = e.velocityY < -300 || (e.velocityY < 300 && y.value < (open + closed) / 2);
      y.value = withSpring(goingUp ? open : closed, SPRING);
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const list = useMemo<SheetList>(() => ({ ref: listRef, scrollY, native }), [listRef, scrollY, native]);

  return (
    <Animated.View style={[styles.sheet, { height: height - open }, style]}>
      <GestureDetector gesture={pan}>
        <View collapsable={false} style={styles.body}>
          <GestureDetector gesture={tap}>
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
          <SheetListContext.Provider value={list}>{children}</SheetListContext.Provider>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

/**
 * Panelin icindeki liste. Kaydirma konumunu panele bildirir ve panelin
 * surukleme hareketiyle ayni anda calisir; panel disinda duz FlatList gibi davranir.
 */
export function SheetFlatList<T>(props: Omit<FlatListProps<T>, "CellRendererComponent">) {
  const ctx = useContext(SheetListContext);
  const fallbackY = useSharedValue(0);
  const scrollY = ctx?.scrollY ?? fallbackY;
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const list = (
    <Animated.FlatList
      {...(props as Omit<FlatListProps<unknown>, "CellRendererComponent">)}
      ref={ctx?.ref}
      onScroll={onScroll}
      scrollEventThrottle={16}
      // Ustte esneme paneli kapatma hareketini yutmasin.
      bounces={false}
      overScrollMode="never"
    />
  );
  return ctx ? <GestureDetector gesture={ctx.native}>{list}</GestureDetector> : list;
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
  body: { flex: 1 },
  handleArea: { alignItems: "center", paddingVertical: 12 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
});
