import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";

import { SEALS_ENABLED } from "@/lib/config";
import { colors, fonts } from "@/theme/tokens";

/**
 * Urunun dunyasindan kucuk nesneler: ikon yerine "ne oluyor"u gosterir.
 * Kodla cizildi (react-native-svg): renk token'lardan gelir, ag gerektirmez.
 */

/** Sabit desenli mini QR: rastgele degil, her cizimde ayni gorunur. */
const QR_BITS = [
  "1110111", "1010101", "1110111", "0001000", "1101011", "0110110", "1011101",
];

/** Turuncu emanet etiketi: ip deligi, beyaz panelde QR, altta iki satir. */
export function LuggageTag({ size = 96, stamp = false }: { size?: number; stamp?: boolean }) {
  const h = size * (160 / 120);
  return (
    <Svg width={size} height={h} viewBox="0 0 120 160">
      <Path d="M60 30 C60 10 80 0 98 6" stroke={colors.inkSecondary} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path
        d="M22 36 L42 16 H78 L98 36 V146 a10 10 0 0 1 -10 10 H32 a10 10 0 0 1 -10 -10 Z"
        fill={colors.brand}
      />
      <Circle cx={60} cy={32} r={6} fill={colors.bg} />
      <Rect x={32} y={54} width={56} height={56} rx={6} fill={colors.white} />
      <G>
        {QR_BITS.map((row, y) =>
          row.split("").map((b, x) =>
            b === "1" ? <Rect key={`${x}-${y}`} x={37 + x * 6.6} y={59 + y * 6.6} width={6} height={6} fill={colors.ink} /> : null,
          ),
        )}
      </G>
      <Rect x={34} y={122} width={52} height={6} rx={3} fill="rgba(255,255,255,0.75)" />
      <Rect x={34} y={134} width={34} height={6} rx={3} fill="rgba(255,255,255,0.5)" />
      {stamp ? (
        <G>
          <Circle cx={96} cy={132} r={18} fill={colors.success} stroke={colors.bg} strokeWidth={4} />
          <Path d="M88 132 l6 6 l11 -12" stroke={colors.white} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      ) : null}
    </Svg>
  );
}

/** Harita parcasi ve fiyat pini; haritadaki pinlerle ayni dil. */
export function MapSnippet({ width = 120, price = "₺70" }: { width?: number; price?: string }) {
  const h = width * 0.8;
  return (
    <Svg width={width} height={h} viewBox="0 0 120 96">
      <Rect x={0} y={0} width={120} height={96} rx={12} fill="#F3EFE7" />
      <Path d="M70 96 C80 70 100 62 120 60 V84 a12 12 0 0 1 -12 12 Z" fill="#CFE2EC" />
      <Path d="M-4 30 C30 34 60 20 124 28" stroke={colors.white} strokeWidth={7} fill="none" />
      <Path d="M-4 30 C30 34 60 20 124 28" stroke="#F4D38A" strokeWidth={3} fill="none" />
      <Path d="M36 -4 C40 30 30 60 44 100" stroke={colors.white} strokeWidth={6} fill="none" />
      <Path d="M84 -4 L76 70" stroke={colors.white} strokeWidth={4} fill="none" />
      <Path d="M0 64 C20 60 40 70 66 62" stroke={colors.white} strokeWidth={4} fill="none" />
      <G>
        <Rect x={48} y={38} width={46} height={24} rx={12} fill={colors.accent} />
        <Path d="M66 61 L71 68 L76 61 Z" fill={colors.accent} />
        <SvgText x={71} y={55} fontSize={13} fontFamily={fonts.bodySemibold} fill={colors.white} textAnchor="middle">
          {price}
        </SvgText>
      </G>
    </Svg>
  );
}

/**
 * Gercek valiz gorseli. Muhur etiketi yalnizca muhur akisi acikken cizilir: kapaliyken
 * ekranda hic olmayan bir "muhur" vaadi gostermesin.
 */
export function SealedBag({ size = 72, sealNo = "0412" }: { size?: number; sealNo?: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require("../../assets/bags/m.webp")}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
      {SEALS_ENABLED ? (
        <View style={[styles.seal, { top: size * 0.34, right: -size * 0.14 }]}>
          <Text style={styles.sealText}>{sealNo}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seal: {
    position: "absolute",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  sealText: { fontFamily: fonts.monoMedium, fontSize: 8, lineHeight: 10, color: colors.white },
});
