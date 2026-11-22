import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="admin/(tabs)" />
      <Stack.Screen name="admin/applications" />
      <Stack.Screen name="admin/broadcast" />
      <Stack.Screen name="admin/booking/[id]" />
      <Stack.Screen name="admin/shop/[id]" />
      <Stack.Screen name="admin/users" />
      {/* Yonetim araclari */}
      <Stack.Screen name="admin/disputes" />
      <Stack.Screen name="admin/dispute/[id]" />
      <Stack.Screen name="admin/coupons" />
      <Stack.Screen name="admin/payments" />
      <Stack.Screen name="admin/platform-settings" />
      <Stack.Screen name="admin/feature-flags" />
    </Stack>
  );
}
