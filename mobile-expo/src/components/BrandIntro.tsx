import { useEffect, useRef, useState } from "react";
import { InteractionManager, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { colors, fonts } from "@/theme/tokens";

/*
  Acilis slogani: "valizini birak, yola bak".

  Yerel acilis ekrani yalnizca gorsel tasir ve degistirmek yeni ikili ister; bu katman
  JS'te oldugu icin OTA ile gider.

  Ilk kare yerel ekranla piksel piksel ayni olmali, yoksa gecis sicrar. Yerel gorsel
  (assets/splash-icon.png) `scripts/generate-brand-assets.mjs` ile 512'lik tuvalin
  ortasina, yuksekligin %90'i kadar cizilir ve 160 genislikte gosterilir. Burada ayni
  SVG (public/brand/logo-mark.svg) ayni olcekle cizilir; boylece valiz, pin ve
  tekerlekler ayri ayri oynatilabilir.

  Koreografi: valiz hafifce coker (hazirlik), ziplar, inerken ezilir ve golgesi yayilir;
  indigi anda pinin gobegi atar ve valizden turuncu bir halka yayilir (konum "ping"i).
  Sonra logo yukari kayar, "BagajPark" harf harf yukselir, iki satir slogan gelir ve
  yol cizgisi cizilip akmaya baslar. Cikista her sey hafifce yukari suzulup solar.

  Surec basina bir kez; dokununca hemen kapanir. "Hareketi azalt" aciksa zipla, halka ve
  akan yol yok: son hali gosterilir ve solar.

  UI ipliginde calisan her yardimci "worklet" olmak zorunda; olmazsa uygulama acilista
  coker (bir kez yasandi).
*/
let playedThisLaunch = false;

// Isaretin geometrisi: viewBox "30 20 420 520"; tuvalde yukseklik 0.9 * 160 = 144.
const BOX = 160;
const S = 144 / 520;
const OFFSET_X = (BOX - 420 * S) / 2;
const OFFSET_Y = (BOX - 520 * S) / 2;
// 160x160 tuvalin tamamini kaplayan viewBox; isaret yerel ekrandaki yerine oturur.
const VIEW_BOX = `${30 - OFFSET_X / S} ${20 - OFFSET_Y / S} ${BOX / S} ${BOX / S}`;
const toBox = (x: number, y: number) => ({ x: OFFSET_X + (x - 30) * S, y: OFFSET_Y + (y - 20) * S });
const PIN_CORE = toBox(240, 246);
const CORE_R = 43.2 * S;
const GROUND_Y = toBox(0, 514).y;
// Ezilme valizin tabanindan olur (tekerleklerin altindaki cizgi).
const SQUASH_ORIGIN = `50% ${(GROUND_Y / BOX) * 100}%`;

const ORANGE = "#EA580C"; // logo-mark.svg ile ayni; tema accent'i metin icin daha koyu
const PIN_PATH =
  "M167.22 298.94 L230.30 385.66 A12 12 0 0 0 249.70 385.66 L312.78 298.94 A90 90 0 1 0 167.22 298.94 Z";

const RING_R = 112;
const ROAD_WIDTH = 132;
const DASH = 8;
const GAP = 4;
const DASH_PERIOD = DASH + GAP;

const EASE_OUT = Easing.out(Easing.cubic);
const LAND_AT = 520; // ms: valizin yere dustugu an
const CLOSE_AT = 2600;
const CLOSE_AT_REDUCED = 1400;
const FADE_OUT_MS = 340;

const WORD = "BagajPark";

export function BrandIntro() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !playedThisLaunch);
  const closing = useRef(false);

  const hopY = useSharedValue(0);
  const squash = useSharedValue(1);
  const shadow = useSharedValue(0);
  const ring = useSharedValue(0);
  const core = useSharedValue(1);
  const lift = useSharedValue(0);
  const word = useSharedValue(0);
  const line1 = useSharedValue(0);
  const line2 = useSharedValue(0);
  const road = useSharedValue(0);
  const march = useSharedValue(0);
  const exit = useSharedValue(0);

  function close() {
    if (closing.current) return;
    closing.current = true;
    exit.value = withTiming(1, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) });
    setTimeout(() => setVisible(false), FADE_OUT_MS + 20);
  }

  function play() {
    if (reduceMotion) {
      lift.value = 1;
      word.value = withTiming(1, { duration: 220 });
      line1.value = withTiming(1, { duration: 220 });
      line2.value = withTiming(1, { duration: 220 });
      road.value = 1;
    } else {
      // Hazirlik cokmesi, sicrama, inis ezilmesi ve yaylanarak toparlanma.
      squash.value = withSequence(
        withTiming(0.92, { duration: 140, easing: EASE_OUT }),
        withTiming(1.05, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 180, easing: Easing.in(Easing.quad) }),
        withTiming(0.88, { duration: 70, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 7, stiffness: 260, mass: 0.7 }),
      );
      hopY.value = withDelay(
        140,
        withSequence(
          withTiming(-22, { duration: 200, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
        ),
      );
      shadow.value = withSequence(
        withTiming(1, { duration: 140 }),
        withDelay(620, withTiming(0, { duration: 320 })),
      );
      ring.value = withDelay(LAND_AT, withTiming(1, { duration: 820, easing: EASE_OUT }));
      core.value = withDelay(
        LAND_AT,
        withSequence(
          withTiming(1.45, { duration: 110, easing: EASE_OUT }),
          withSpring(1, { damping: 6, stiffness: 220 }),
        ),
      );
      lift.value = withDelay(720, withTiming(1, { duration: 560, easing: EASE_OUT }));
      word.value = withDelay(860, withTiming(1, { duration: 620, easing: Easing.linear }));
      line1.value = withDelay(1180, withTiming(1, { duration: 440, easing: EASE_OUT }));
      line2.value = withDelay(1330, withTiming(1, { duration: 440, easing: EASE_OUT }));
      road.value = withDelay(1480, withTiming(1, { duration: 520, easing: Easing.inOut(Easing.cubic) }));
      march.value = withDelay(
        1480,
        withRepeat(withTiming(1, { duration: 480, easing: Easing.linear }), -1, false),
      );
    }
  }

  useEffect(() => {
    if (!visible) return;
    playedThisLaunch = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;

    // Ilk kare yerel acilis ekraniyla ayni, durgun: alttaki ekranlarin ilk kurulumu
    // bitmeden baslarsa UI ipligi kurulumla yarisir ve animasyon takilir (2026-11-23,
    // emulatorde 99. yuzdelik 200 ms). Kurulum bitince ya da en gec 450 ms sonra baslar.
    const start = () => {
      if (started) return;
      started = true;
      play();
      timer = setTimeout(close, reduceMotion ? CLOSE_AT_REDUCED : CLOSE_AT);
    };
    const task = InteractionManager.runAfterInteractions(() => requestAnimationFrame(start));
    const fallback = setTimeout(start, 450);
    return () => {
      task.cancel();
      clearTimeout(fallback);
      if (timer) clearTimeout(timer);
      cancelAnimation(march);
    };
    // Yalnizca ilk kurulumda oynar; paylasilan degerler ve close sabit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -12 * exit.value }] }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -64 * lift.value }, { scale: 1 - 0.18 * lift.value }],
  }));
  // Hacim korunur: dikeyde ezilirken yataya yayilir.
  const markStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: hopY.value },
      { scaleX: 1 + (1 - squash.value) * 0.6 },
      { scaleY: squash.value },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 * shadow.value * (1 + hopY.value / 44),
    transform: [{ scaleX: 1 + hopY.value / 40 + (1 - squash.value) * 0.8 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 ? 0.5 * (1 - ring.value) : 0,
    transform: [{ scale: 0.3 + 0.7 * ring.value }],
  }));
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: core.value }] }));
  const line1Style = useAnimatedStyle(() => rise(line1));
  const line2Style = useAnimatedStyle(() => rise(line2));
  // Genislik degil kaydirma: yerlesim ozelligini her karede canlandirmak yeni
  // mimaride her karede yerlesim hesabi demek; sabit genislikte kirpilan serit kayar.
  const roadRevealStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -ROAD_WIDTH * (1 - road.value) }],
  }));
  const roadMarchStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -DASH_PERIOD * march.value }] }));

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
        accessibilityLabel={`${WORD}. ${line1Text} ${line2Text}`}
        accessibilityHint={t("intro.skipHint")}
      >
        <Animated.View style={[styles.center, contentStyle]} pointerEvents="none">
          <Animated.View style={[styles.logoBox, logoStyle]}>
            {/* Donanim katmani: SVG ve kenarlik her karede yeniden cizilmez, GPU'da olceklenir. */}
            <Animated.View style={[styles.ring, ringStyle]} renderToHardwareTextureAndroid />
            <Animated.View style={[styles.shadow, shadowStyle]} />
            <Animated.View
              style={[StyleSheet.absoluteFill, { transformOrigin: SQUASH_ORIGIN }, markStyle]}
              renderToHardwareTextureAndroid
              shouldRasterizeIOS
            >
              <Svg width={BOX} height={BOX} viewBox={VIEW_BOX}>
                <Path
                  d="M170 140 V92 a36 36 0 0 1 36 -36 h68 a36 36 0 0 1 36 36 V140"
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth={32}
                />
                <Rect x={60} y={112} width={360} height={340} rx={56} fill={ORANGE} />
                <Circle cx={140} cy={482} r={32} fill={ORANGE} />
                <Circle cx={340} cy={482} r={32} fill={ORANGE} />
                <Path d={PIN_PATH} fill="#fff" stroke="#fff" strokeWidth={40} strokeLinejoin="round" />
                <Path d={PIN_PATH} fill={ORANGE} />
              </Svg>
              <Animated.View style={[styles.core, coreStyle]} />
            </Animated.View>
          </Animated.View>

          <View style={styles.textBlock}>
            <View style={styles.wordRow}>
              {WORD.split("").map((ch, i) => (
                <Letter key={i} ch={ch} index={i} progress={word} />
              ))}
            </View>
            <Animated.Text style={[styles.line1, line1Style]}>{line1Text}</Animated.Text>
            <Animated.Text style={[styles.line2, line2Style]}>{line2Text}</Animated.Text>
            <View style={styles.roadTrack}>
              <Animated.View style={roadRevealStyle}>
                <Animated.View style={[styles.road, roadMarchStyle]}>
                  {Array.from({ length: Math.ceil(ROAD_WIDTH / DASH_PERIOD) + 2 }, (_, i) => (
                    <View key={i} style={styles.dash} />
                  ))}
                </Animated.View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function rise(v: SharedValue<number>) {
  "worklet";
  return { opacity: v.value, transform: [{ translateY: 10 * (1 - v.value) }] };
}

/** Harf harf yukselme: her harf ilerlemenin kendi diliminde 0'dan 1'e gider. */
function Letter({ ch, index, progress }: { ch: string; index: number; progress: SharedValue<number> }) {
  const step = 0.5 / (WORD.length - 1);
  const style = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [index * step, index * step + 0.5], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: 14 * (1 - p) }] };
  });
  return <Animated.Text style={[styles.word, style]}>{ch}</Animated.Text>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoBox: { width: BOX, height: BOX },
  ring: {
    position: "absolute",
    left: PIN_CORE.x - RING_R,
    top: PIN_CORE.y - RING_R,
    width: RING_R * 2,
    height: RING_R * 2,
    borderRadius: RING_R,
    borderWidth: 3,
    borderColor: ORANGE,
  },
  shadow: {
    position: "absolute",
    left: BOX / 2 - 48,
    top: GROUND_Y - 4,
    width: 96,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },
  core: {
    position: "absolute",
    left: PIN_CORE.x - CORE_R,
    top: PIN_CORE.y - CORE_R,
    width: CORE_R * 2,
    height: CORE_R * 2,
    borderRadius: CORE_R,
    backgroundColor: "#fff",
  },
  // Logo 64 yukari kayip kuculunce acilan bosluga oturur; blok ortanin hemen altinda.
  textBlock: { position: "absolute", top: "50%", marginTop: 8, alignItems: "center", paddingHorizontal: 24 },
  wordRow: { flexDirection: "row" },
  word: { fontFamily: fonts.hero, fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: -0.3 },
  line1: {
    marginTop: 16,
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    lineHeight: 28,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  line2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.accent, textAlign: "center" },
  roadTrack: { marginTop: 16, width: ROAD_WIDTH, height: 3, overflow: "hidden", alignSelf: "center" },
  road: { width: ROAD_WIDTH + DASH_PERIOD * 2, height: 3, flexDirection: "row", gap: GAP },
  dash: { width: DASH, height: 3, borderRadius: 2, backgroundColor: colors.accent, opacity: 0.5 },
});
