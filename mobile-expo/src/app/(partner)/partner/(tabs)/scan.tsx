import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Flashlight, FlashlightOff } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useTranslation } from "react-i18next";

import { LuggageTag } from "@/components/Illustrations";
import { Input } from "@/components/Field";
import { AppText, Banner, Button, CenterMessage } from "@/components/ui";
import { bookingCode, searchBookings } from "@/lib/booking-search";
import { usePartnerBookings } from "@/lib/queries";
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
  const [torch, setTorch] = useState(false);
  // Sekmeye her gelisde eski hata/mesaj ve fener sifirlansin: eski kirmizi banner hala gecerli sanilmasin.
  useFocusEffect(
    useCallback(
      () => () => {
        setMessage(null);
        setTorch(false);
      },
      [],
    ),
  );
  // Kamera ayni kodu saniyede onlarca kez okur; tek istek gitsin.
  const busy = useRef(false);

  async function onScanned(code: string) {
    if (busy.current) return;
    busy.current = true;
    setMessage(null);
    try {
      const res = await api<ScanResult>("/seals/scan", { method: "POST", body: { code } });
      if (res.type === "booking") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <CenterMessage
          art={<LuggageTag size={72} />}
          title={t("scan.permissionTitle")}
          body={t("scan.permissionBody")}
          action={
            <View style={{ gap: space.md, alignSelf: "stretch" }}>
              {permission.canAskAgain ? (
                <Button title={t("scan.allow")} onPress={() => void requestPermission()} />
              ) : (
                // Kalici reddedildiyse tekrar sorulamaz: tek cikis sistem ayari (sekme cubugu
                // zaten gorunur, ayri bir "Geri" gerekmez).
                <Button title={t("scan.openSettings")} onPress={() => void Linking.openSettings().catch(() => undefined)} />
              )}
              {/* Kamera yokken de misafir kodla ya da adla bulunabilsin. */}
              <ManualLookup />
            </View>
          }
        />
        </ScrollView>
        </KeyboardAvoidingView>
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
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => void onScanned(data)}
      />
      ) : null}
      <SafeAreaView style={styles.overlaySafe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Klavye acilinca icerik kayabilsin: arama kutusu, buton ve eslesme listesi gorunur kalsin. */}
      <ScrollView contentContainerStyle={styles.overlay} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.top}>
          <AppText variant="title" style={{ color: colors.white, flex: 1 }}>
            {t("scan.open")}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? t("scan.torchOff") : t("scan.torchOn")}
            onPress={() => setTorch((v) => !v)}
            style={styles.torch}
          >
            {torch ? <FlashlightOff size={22} color={colors.white} /> : <Flashlight size={22} color={colors.white} />}
          </Pressable>
        </View>
        <View style={styles.frame} accessibilityLabel={t("scan.hint")} />
        <View style={{ gap: space.md }}>
          <View style={styles.hint}>
            <AppText variant="bodyMedium" style={{ textAlign: "center", color: colors.white }}>
              {t("scan.hint")}
            </AppText>
          </View>
          {message ? <Banner tone={message.tone} body={message.body} /> : null}
          <View style={styles.manual}>
            <ManualLookup />
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: "#000" },
  overlaySafe: { flex: 1 },
  overlay: { flexGrow: 1, justifyContent: "space-between", gap: space.lg, padding: space.xl },
  top: { flexDirection: "row", justifyContent: "flex-start", alignItems: "center" },
  torch: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  manual: { backgroundColor: colors.bg, borderRadius: radius.control, padding: space.md },
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

/**
 * QR okunamiyorsa (kirik ekran, bos pil, kamera izni yok): 8 haneli kod ya da misafir adi.
 * Arama esnafin yuklu listesinde yapilir; tek eslesmede detay acilir, birden fazlada secilir.
 */
function ManualLookup() {
  const { t } = useTranslation();
  const bookings = usePartnerBookings(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<{ id: string; guestName: string }[] | null>(null);

  function search() {
    const found = searchBookings(bookings.data?.items ?? [], text);
    if (found.length === 1) {
      setMatches(null);
      router.push(`/partner/${found[0].id}`);
      return;
    }
    setMatches(found.slice(0, 5));
  }

  if (!open) {
    return <Button variant="secondary" title={t("scan.manualOpen")} onPress={() => setOpen(true)} />;
  }
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="bodyMedium">{t("scan.manualTitle")}</AppText>
      <Input
        accessibilityLabel={t("scan.manualTitle")}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setMatches(null);
        }}
        placeholder={t("scan.manualPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={search}
        maxLength={60}
      />
      <Button title={t("scan.manualSearch")} disabled={text.trim().length === 0} onPress={search} />
      {matches && matches.length === 0 ? <Banner tone="danger" body={t("scan.manualNone")} /> : null}
      {matches && matches.length > 1 ? <AppText variant="caption">{t("scan.manualMany")}</AppText> : null}
      {matches && matches.length > 1
        ? matches.map((m) => (
            <Button
              key={m.id}
              variant="secondary"
              title={`${m.guestName || t("partner.guest")} · #${bookingCode(m.id)}`}
              onPress={() => router.push(`/partner/${m.id}`)}
            />
          ))
        : null}
      <Button variant="ghost" title={t("scan.manualClose")} onPress={() => setOpen(false)} />
    </View>
  );
}
