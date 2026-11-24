import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="admin/(tabs)" />
      <Stack.Screen name="admin/applications" />
      <Stack.Screen name="admin/partner-leads" />
      <Stack.Screen name="admin/broadcast" />
      <Stack.Screen name="admin/booking/[id]" />
      <Stack.Screen name="admin/shop/[id]" />
      <Stack.Screen name="admin/users" />
      {/* Kullanici yonetimi: detay + denetim kaydi */}
      <Stack.Screen name="admin/user/[id]" />
      <Stack.Screen name="admin/audit-log" />
      <Stack.Screen name="admin/role-approvals" />

      {/* Dukkan icerigi + yorum moderasyonu */}
      <Stack.Screen name="admin/shop-photos/[id]" />
      <Stack.Screen name="admin/shop-schedule/[id]" />
      <Stack.Screen name="admin/reviews" />

      {/* Yonetim araclari */}
      <Stack.Screen name="admin/disputes" />
      <Stack.Screen name="admin/dispute/[id]" />
      <Stack.Screen name="admin/coupons" />
      <Stack.Screen name="admin/affiliates" />
      <Stack.Screen name="admin/payments" />
      <Stack.Screen name="admin/platform-settings" />
      <Stack.Screen name="admin/feature-flags" />
      <Stack.Screen name="admin/campaigns" />
      <Stack.Screen name="admin/partner-new" />

      {/* Gorunurluk (salt okuma) */}
      <Stack.Screen name="admin/analytics" />
      <Stack.Screen name="admin/system" />
      <Stack.Screen name="admin/notifications" />
      <Stack.Screen name="admin/prelaunch" />
    </Stack>
  );
}
