import "@/lib/i18n";

import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";

import { ApiError } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SearchProvider } from "@/lib/search";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx tekrar denemekle duzelmez; yalnizca ag/5xx hatalarini bir kez dene.
      retry: (count, err) => count < 1 && (!(err instanceof ApiError) || err.status === 0 || err.status >= 500),
    },
  },
});

function RootNavigator() {
  const { state } = useAuth();
  const role = state.status === "signedIn" ? state.user.role : null;

  useEffect(() => {
    if (state.status !== "loading") void SplashScreen.hideAsync().catch(() => undefined);
  }, [state.status]);

  if (state.status === "loading") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={state.status === "signedOut"}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={role === "GUEST"}>
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
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SearchProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SearchProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
