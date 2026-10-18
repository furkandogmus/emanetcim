import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="admin/index" />
      <Stack.Screen name="admin/applications" />
      <Stack.Screen name="admin/messages" />
    </Stack>
  );
}
