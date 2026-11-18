import { useState } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

import { RemoteImage } from "@/components/RemoteImage";
import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Dukkan fotograflari: kapak once, galeri ardindan; sayfa sayfa kaydirilir. Tek fotograf
 * varsa sayac ve noktalar cizilmez. Yalnizca gorunen ve komsusu yuklenir.
 */
export function PhotoPager({ photos, height }: { photos: string[]; height: number }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  return (
    <View style={{ height }}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u, i) => `${i}-${u}`}
        initialNumToRender={2}
        windowSize={3}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <RemoteImage
            src={item}
            width={width}
            style={{ width, height }}
            contentFit="cover"
            accessibilityLabel={t("shop.photoN", { n: i + 1, total: photos.length })}
          />
        )}
      />
      {photos.length > 1 ? (
        <>
          <View style={styles.counter}>
            <AppText variant="label" style={{ color: colors.white, fontSize: 12 }}>
              {index + 1}/{photos.length}
            </AppText>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    position: "absolute",
    right: space.lg,
    bottom: space.xxl + space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(28,25,23,0.55)",
  },
  dots: {
    position: "absolute",
    bottom: space.xxl + space.sm,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotOn: { backgroundColor: colors.white, width: 16 },
});
