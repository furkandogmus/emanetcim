import "@/lib/intl-polyfills";
import "@/lib/i18n";

import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";

import { ApiError } from "@/lib/api";
import { pingAppOpen } from "@/lib/app-ping";
import { AuthProvider, useAuth } from "@/lib/auth";
import { openFromNotification, registerForPush } from "@/lib/push";
import { SearchProvider } from "@/lib/search";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// RN'de "pencere odagi" yok: baglanmazsa refetchOnWindowFocus hic tetiklenmez ve
// arka plandaki uygulama refetchInterval ile istek atmayi surdurur.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (st) => setFocused(st === "active"));
  return () => sub.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx tekrar denemekle duzelmez; yalnizca ag/5xx hatalarini bir kez dene.
      retry: (count, err) => count < 1 && (!(err instanceof ApiError) || err.status === 0 || err.status >= 500),
    },
  },
});

function useSearchKey(userId: string | null): string {
  const [k, setK] = useState<{ n: number; userId: string | null }>({ n: 0, userId: null });
  if (userId !== k.userId) {
    // Girissizden girise geciste anahtar AYNI kalir (secim korunur); digerlerinde yenilenir.
    const anonToUser = k.userId === null && userId !== null;
    setK({ n: anonToUser ? k.n : k.n + 1, userId });
  }
  return `search-${k.n}`;
}

function RootNavigator() {
  const { state } = useAuth();
  const role = state.status === "signedIn" ? state.user.role : null;

  useEffect(() => {
    if (state.status !== "loading") void SplashScreen.hideAsync().catch(() => undefined);
  }, [state.status]);

  // Tekil kullanici sayaci: gunde bir; giris yapilinca hesap cihaza baglansin diye bir kez daha.
  const userId = state.status === "signedIn" ? state.user.id : null;
  useEffect(() => {
    if (state.status === "loading") return;
    void pingAppOpen(userId).catch(() => undefined);
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") void pingAppOpen(userId).catch(() => undefined);
    });
    return () => sub.remove();
  }, [state.status, userId]);

  // Oturum acikken cihaz bildirime kaydolur; izin reddi ya da ag hatasi uygulamayi durdurmaz.
  useEffect(() => {
    if (state.status !== "signedIn") return;
    void registerForPush({ prompt: role !== "GUEST" }).catch(() => undefined);
    // Uygulama kapaliyken dokunulan bildirim de acilsin.
    // Son yanit surec boyunca kalir: temizlenmezse cikis/giristen sonra ayni rezervasyon
    // (baska kullanicida 403) yeniden aciliyordu. Bir kez isle, sonra sil.
    void Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (!r) return;
        Notifications.clearLastNotificationResponse();
        openFromNotification(r, role);
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => openFromNotification(r, role));
    /*
      Uygulama ACIKKEN gelen bildirim ekrandaki veriyi tazeler: esnaf check-in
      yapinca ya da valiz duzeltmesi onerince misafirin elindeki ekran eski
      durumda kaliyordu (onay karti ancak asagi cekince cikiyordu).
    */
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["partner"] });
    });
    return () => {
      sub.remove();
      received.remove();
    };
  }, [state.status, role]);

  /*
    Arama durumu kullaniciya ait: hesap degisince sifirlanir. AMA girissiz gezip
    "Rezervasyon yap"ta giris yapan misafirin sectigi yer/tarih/valiz korunur:
    anahtar yalnizca cikista yenilenir, girissizden girise geciste ayni kalir.
  */
  const searchKey = useSearchKey(state.status === "signedIn" ? state.user.id : null);

  if (state.status === "loading") return null;

  // Arama durumu kullaniciya ait: anahtar degisince sifirlanir, sonraki hesap oncekinin
  // konumunu ("Yakinimda" GPS dahil), tarihlerini ve valizlerini devralmaz.
  return (
    <SearchProvider key={searchKey}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={state.status === "signedOut"}>
          <Stack.Screen name="login" />
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
        {/* Misafir alani girissiz de acik; rezervasyon, profil ve odeme girisi ister. */}
        <Stack.Protected guard={role === "GUEST" || state.status === "signedOut"}>
          <Stack.Screen name="(guest)" />
        </Stack.Protected>
        <Stack.Protected guard={role === "ADMIN"}>
          <Stack.Screen name="(admin)" />
        </Stack.Protected>
        <Stack.Protected guard={role === "PARTNER"}>
          <Stack.Screen name="(partner)" />
        </Stack.Protected>
        <Stack.Protected guard={state.status === "signedIn"}>
          <Stack.Screen name="profile" options={{ presentation: "modal" }} />
          <Stack.Screen name="profile-edit" options={{ presentation: "modal" }} />
        </Stack.Protected>
      </Stack>
    </SearchProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_500Medium,
  });
  // Saglayicilar font beklemeden kurulur: oturum geri yukleme (SecureStore + /auth/me)
  // font yuklemesiyle paralel calisir. Acilis ekrani ikisi de bitene kadar kalir.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          {fontsLoaded ? <RootNavigator /> : null}
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
