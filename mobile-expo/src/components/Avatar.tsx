import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { RemoteImage } from "@/components/RemoteImage";
import { resolveImage } from "@/lib/images";
import { colors, fonts } from "@/theme/tokens";

/** Fotograf varsa fotograf, yoksa notr zemin uzerinde bas harf (her yerde ayni). */
export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const src = resolveImage(url);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (src) return <RemoteImage src={url} width={size} style={[styles.base, box]} contentFit="cover" />;
  return (
    <View style={[styles.base, box]}>
      <AppText style={[styles.text, { fontSize: Math.round(size * 0.38) }]}>{initials(name)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  text: { fontFamily: fonts.display, color: colors.inkSecondary },
});

/** "Elif Kaya" -> "EK"; e-posta tek harf. */
export function initials(name: string) {
  const parts = name
    .normalize("NFC")
    .split(/[\s@.]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (name.includes("@") ? "" : (parts[1]?.[0] ?? ""))).toLocaleUpperCase("tr-TR") || "?";
}
