import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import * as Updates from "expo-updates";
import { usePathname } from "expo-router";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isOtaBannerBlocked, isUpdateRequired, openPlayStore } from "@/lib/app-update";
import { AppText, Button, IconButton } from "@/components/ui";
import { colors, radius, space } from "@/theme/tokens";

/** Arka plandan donuste OTA'yi en fazla bu sikliktan bir kontrol et. */
const OTA_CHECK_MIN_GAP_MS = 5 * 60_000;

/**
 * Acilista `/config` okunur; yuklu ikili `minAppVersion`un altindaysa uygulama
 * engellenir ve Play baglantisi gosterilir. Ag hatasinda kapi acik kalir.
 * Acilisi bekletmez: yanit gelene kadar uygulama normal acilir.
 */
export function useUpdateRequired(): boolean {
  const [required, setRequired] = useState(false);
  useEffect(() => {
    let alive = true;
    let last = 0;
    // Uygulama gunlerce arka planda kalabilir: min surum sonradan yukselirse
    // one gelince yeniden sor (OTA kontroluyle ayni 5 dakikalik sinir).
    const check = () => {
      const now = Date.now();
      if (now - last < OTA_CHECK_MIN_GAP_MS) return;
      last = now;
      void isUpdateRequired().then((r) => {
        if (alive && r) setRequired(true);
      });
    };
    check();
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return required;
}

export function ForcedUpdateScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.gate}>
      <AppText variant="title" style={styles.center}>
        {t("update.requiredTitle")}
      </AppText>
      <AppText variant="body" style={[styles.center, { color: colors.inkSecondary }]}>
        {t("update.requiredBody")}
      </AppText>
      <Button title={t("update.requiredCta")} onPress={() => void openPlayStore()} />
    </View>
  );
}

/**
 * Uygulama on plana her dondugunde yeni JS paketi var mi diye bakar ve indirir;
 * hazir olunca "Yeni surum hazir, yenile" seridi cikar. Yeniden baslatma yalnizca
 * kullanici dokununca olur; serit ustte durur, kapatilabilir ve odeme/QR ekraninda hic cikmaz.
 */
export function OtaReadyBanner() {
  const { t } = useTranslation();
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const lastCheck = useRef(0);
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const check = () => {
      const now = Date.now();
      if (now - lastCheck.current < OTA_CHECK_MIN_GAP_MS) return;
      lastCheck.current = now;
      void Updates.checkForUpdateAsync()
        .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch(() => undefined);
    };
    check();
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") check();
    });
    return () => sub.remove();
  }, []);

  if (!isUpdatePending || dismissed || isOtaBannerBlocked(pathname)) return null;
  return (
    <View style={[styles.ota, { top: insets.top + space.sm }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AppText variant="bodyMedium" style={{ flex: 1 }}>
        {t("update.readyBody")}
      </AppText>
      <Button
        title={t("update.readyCta")}
        style={styles.otaButton}
        onPress={() => void Updates.reloadAsync().catch(() => undefined)}
      />
      <IconButton label={t("common.close")} onPress={() => setDismissed(true)}>
        <X size={20} color={colors.inkSecondary} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
    backgroundColor: colors.bg,
  },
  center: { textAlign: "center" },
  ota: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  otaButton: { paddingHorizontal: space.lg },
});
