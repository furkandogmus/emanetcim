import { Stack } from "expo-router";

import { PartnerShopProvider } from "@/lib/partner-shop";
import { colors } from "@/theme/tokens";

export default function PartnerLayout() {
  return (
    <PartnerShopProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="partner/(tabs)" />
        <Stack.Screen name="partner/seals" />
        <Stack.Screen name="partner/earnings" />
        <Stack.Screen name="partner/settings" />
        <Stack.Screen name="partner/location" />
        <Stack.Screen name="partner/schedule" />
        <Stack.Screen name="partner/referral" />
        <Stack.Screen name="partner/team" />
        <Stack.Screen name="partner/[id]" />
      </Stack>
    </PartnerShopProvider>
  );
}
