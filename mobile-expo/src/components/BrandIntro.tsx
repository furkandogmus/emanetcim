import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { colors, fonts } from "@/theme/tokens";

/*
  Acilis slogani. Yerel acilis ekrani (expo-splash-screen) yalnizca gorsel tasir ve
  degistirmek yeni ikili ister; bu katman JS'te oldugu icin OTA ile gider.

  Ilk kare yerel ekranla birebir ayni: ayni zemin, ayni gorsel, ayni 160 genislik,
  ekranin ortasi. Gecis bu yuzden sicramaz; logo yukari kayar, alti dolar.

  Surec basina bir kez: arama anahtari degisip agac yeniden kurulsa da tekrar oynamaz.
  Dokununca hemen kapanir; "hareketi azalt" aciksa kayma yok, yalnizca solma.
*/
let playedThisLaunch = false;

const EASE = Easing.out(Easing.cubic);
const HOLD_MS = 1500;
const FADE_OUT_MS = 320;
const ROAD_WIDTH = 132;

export function BrandIntro() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !playedThisLaunch);
  const closing = useRef(false);

  const lift = useSharedValue(0);
  const word = useSharedValue(0);
  const line1 = useSharedValue(0);
  const line2 = useSharedValue(0);
  const road = useSharedValue(0);
  const overlay = useSharedValue(1);

  function close() {
    if (closing.current) return;
    closing.current = true;
    overlay.value = withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) });
    setTimeout(() => setVisible(false), FADE_OUT_MS + 20);
  }

  useEffect(() => {
    if (!visible) return;
    playedThisLaunch = true;
    if (reduceMotion) {
      lift.value = 1;
      word.value = withTiming(1, { duration: 200 });
      line1.value = withTiming(1, { duration: 200 });
      line2.value = withTiming(1, { duration: 200 });
      road.value = 1;
    } else {
      lift.value = withTiming(1, { duration: 520, easing: EASE });
      word.value = withDelay(180, withTiming(1, { duration: 420, easing: EASE }));
      line1.value = withDelay(380, withTiming(1, { duration: 420, easing: EASE }));
      line2.value = withDelay(540, withTiming(1, { duration: 420, easing: EASE }));
      road.value = withDelay(700, withTiming(1, { duration: 640, easing: Easing.inOut(Easing.cubic) }));
    }
    const timer = setTimeout(close, (reduceMotion ? 300 : 900) + HOLD_MS);
    return () => clearTimeout(timer);
    // Yalnizca ilk kurulumda oynar; paylasilan degerler ve close sabit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -64 * lift.value }, { scale: 1 - 0.18 * lift.value }],
  }));
  // UI ipliginde calisir: "worklet" olmazsa uygulama acilista coker.
  const rise = (v: { value: number }) => {
    "worklet";
    return { opacity: v.value, transform: [{ translateY: 10 * (1 - v.value) }] };
  };
  const wordStyle = useAnimatedStyle(() => rise(word));
  const line1Style = useAnimatedStyle(() => rise(line1));
  const line2Style = useAnimatedStyle(() => rise(line2));
  const roadStyle = useAnimatedStyle(() => ({ width: ROAD_WIDTH * road.value }));

  if (!visible) return null;

  const line1Text = t("intro.sloganLine1");
  const line2Text = t("intro.sloganLine2");
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, overlayStyle]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`BagajPark. ${line1Text} ${line2Text}`}
        accessibilityHint={t("intro.skipHint")}
      >
        <View style={styles.center} pointerEvents="none">
          <Animated.View style={logoStyle}>
            <Image source={require("../../assets/splash-icon.png")} style={styles.logo} contentFit="contain" priority="high" transition={0} />
          </Animated.View>
          <View style={styles.textBlock}>
            <Animated.Text style={[styles.word, wordStyle]}>BagajPark</Animated.Text>
            <Animated.Text style={[styles.line1, line1Style]}>{line1Text}</Animated.Text>
            <Animated.Text style={[styles.line2, line2Style]}>{line2Text}</Animated.Text>
            <View style={styles.roadTrack}>
              <Animated.View style={[styles.road, roadStyle]}>
                {Array.from({ length: 11 }, (_, i) => (
                  <View key={i} style={styles.dash} />
                ))}
              </Animated.View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 160, height: 160 },
  // Logo 64 yukari kayip kuculunce acilan bosluga oturur; blok ortanin hemen altinda.
  textBlock: { position: "absolute", top: "50%", marginTop: 8, alignItems: "center", paddingHorizontal: 24 },
  word: { fontFamily: fonts.hero, fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: -0.5 },
  line1: { marginTop: 16, fontFamily: fonts.displayMedium, fontSize: 22, lineHeight: 28, color: colors.inkSecondary, textAlign: "center" },
  line2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.accent, textAlign: "center" },
  roadTrack: { marginTop: 16, width: ROAD_WIDTH, height: 3, alignItems: "flex-start" },
  road: { height: 3, flexDirection: "row", overflow: "hidden", gap: 4 },
  dash: { width: 8, height: 3, borderRadius: 2, backgroundColor: colors.accent, opacity: 0.45 },
});
