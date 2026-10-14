import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function GuestLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="search" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="map" />
      <Stack.Screen name="shop/[id]" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="success" options={{ gestureEnabled: false }} />
      <Stack.Screen name="bookings/index" />
      <Stack.Screen name="bookings/[id]" />
    </Stack>
  );
}
