import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function PartnerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="partner/index" />
      <Stack.Screen name="partner/shop" />
      <Stack.Screen name="partner/[id]" />
    </Stack>
  );
}
