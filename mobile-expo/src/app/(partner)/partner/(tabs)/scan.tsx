import { useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useTranslation } from "react-i18next";

import { LuggageTag } from "@/components/Illustrations";
import { AppText, Banner, Button, CenterMessage } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { colors, radius, space } from "@/theme/tokens";

type ScanResult =
  | { type: "booking"; id: string; status: string; guestName: string }
  | { type: "seal"; serialNumber: number; status: string };

/**
 * Esnaf misafirin QR'ini okutur; sunucu (`seals/scan`) imzali token'i cozer ve
 * dukkanin kendi rezervasyonu mu diye bakar. Rezervasyon ise teslim ekrani
 * acilir; muhur seri numarasi ise muhurun durumu gosterilir.
 */
export default function PartnerScanScreen() {
  const { t } = useTranslation();
  const focused = useIsFocused();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // Kanca izni yalnizca acilista okur: Ayarlar'dan izin verip donunce sekme hala
  // "izin yok" gosteriyordu. On plana donuste ve sekmeye geliste yeniden oku.
  useEffect(() => {
    if (focused) void getPermission().catch(() => undefined);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void getPermission().catch(() => undefined);
    });
    return () => sub.remove();
  }, [focused, getPermission]);
  const [message, setMessage] = useState<{ tone: "danger" | "brand"; body: string } | null>(null);
  // Kamera ayni kodu saniyede onlarca kez okur; tek istek gitsin.
  const busy = useRef(false);

  async function onScanned(code: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await api<ScanResult>("/seals/scan", { method: "POST", body: { code } });
      if (res.type === "booking") {
        // Sekmede: push ki detaydan geri donunce tarayici yine burada olsun.
        router.push(`/partner/${res.id}`);
        return;
      }
      setMessage({ tone: "brand", body: t("scan.seal", { n: res.serialNumber, status: t(`scan.sealStatus.${res.status}`, { defaultValue: res.status }) }) });
    } catch (e) {
      setMessage({ tone: "danger", body: errorMessage(e, "scan") });
    } finally {
      // finally: rezervasyon bulunup detaya gecildiginde de kilit acilsin. Eskiden o dalda
      // `return` zamanlayiciyi atliyordu ve sekme acik kaldigi icin tarayici bir daha
      // hic okumuyordu (oturum basina tek misafir).
      setTimeout(() => {
        busy.current = false;
      }, 2500);
    }
  }

  if (!permission) return <View style={styles.safe} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <CenterMessage
          art={<LuggageTag size={72} />}
          title={t("scan.permissionTitle")}
          body={t("scan.permissionBody")}
          action={
            permission.canAskAgain ? (
              <Button title={t("scan.allow")} onPress={() => void requestPermission()} />
            ) : (
              // Kalici reddedildiyse tekrar sorulamaz: tek cikis sistem ayari (sekme cubugu
              // zaten gorunur, ayri bir "Geri" gerekmez).
              <Button title={t("scan.openSettings")} onPress={() => void Linking.openSettings().catch(() => undefined)} />
            )
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {/* Kamera yalnizca sekme gorunurken acik: baska sekmeye gecince pil ve izin isigi kapanir. */}
      {focused ? (
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => void onScanned(data)}
      />
      ) : null}
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <AppText variant="title" style={{ color: colors.white }}>
            {t("scan.open")}
          </AppText>
        </View>
        <View style={styles.frame} accessibilityLabel={t("scan.hint")} />
        <View style={{ gap: space.md }}>
          <View style={styles.hint}>
            <AppText variant="bodyMedium" style={{ textAlign: "center", color: colors.white }}>
              {t("scan.hint")}
            </AppText>
          </View>
          {message ? <Banner tone={message.tone} body={message.body} /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, justifyContent: "space-between", padding: space.xl },
  top: { flexDirection: "row", justifyContent: "flex-start" },
  frame: {
    alignSelf: "center",
    width: 240,
    height: 240,
    borderRadius: radius.card,
    borderWidth: 3,
    borderColor: colors.white,
  },
  hint: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: radius.control, padding: space.md },
});
