import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

/**
 * Uygulama baglantisindan (`/shop/<id>`) soguk acilista yigin tek ekran kalirdi ve
 * geri oku hicbir sey yapmazdi. Altta ana sayfa durur.
 */
export const unstable_settings = { initialRouteName: "(tabs)" };

export default function GuestLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="map" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="shop/[id]" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="success" options={{ gestureEnabled: false }} />
      <Stack.Screen name="bookings/[id]" />
      <Stack.Screen name="bookings/modify" />
    </Stack>
  );
}
