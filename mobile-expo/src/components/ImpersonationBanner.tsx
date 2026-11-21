import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { impersonationLabel } from "@/lib/impersonation";
import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * Yonetici baska bir kullanici olarak goruntulerken her ekranin ustunde sabit serit.
 * Ust guvenli alani serit tuketir. Alttaki ekranlar IC ICE bir `SafeAreaProvider`
 * icinde: saglayici kendi cercevesini yerel olarak olcer, bu yuzden hem
 * `useSafeAreaInsets` hem yerel `<SafeAreaView edges={["top"]}>` (yaklasik 26 ekran)
 * seridin altinda ikinci bir durum cubugu boslugu birakmaz. Eskiden yalnizca
 * context degeri sifirlaniyordu; yerel `SafeAreaView` onu okumaz, bosluk kaliyordu.
 */
export function ImpersonationFrame({ children }: { children: ReactNode }) {
  const { impersonating, stopImpersonation } = useAuth();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { t } = useTranslation();
  if (!impersonating) return <>{children}</>;

  const name = impersonationLabel(impersonating.user);
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]} accessibilityRole="alert">
        <AppText variant="bodyMedium" style={styles.text} numberOfLines={1}>
          {t("impersonation.banner", { name })}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("impersonation.exitLabel")}
          hitSlop={8}
          onPress={() => void stopImpersonation().catch(() => undefined)}
          style={({ pressed }) => [styles.exit, pressed && { opacity: 0.7 }]}
        >
          <AppText variant="bodyMedium" style={styles.exitText}>
            {t("impersonation.exit")}
          </AppText>
        </Pressable>
      </View>
      <SafeAreaProvider style={styles.root} initialMetrics={{ frame, insets: { ...insets, top: 0 } }}>
        {children}
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: colors.accent,
  },
  text: { flex: 1, color: colors.white },
  exit: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  exitText: { color: colors.accent, fontFamily: fonts.bodySemibold },
});
