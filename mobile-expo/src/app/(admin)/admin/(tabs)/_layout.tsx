import { Tabs } from "expo-router";
import { Inbox, LayoutGrid, Store, Ticket } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useAdminOverview } from "@/lib/queries";
import { colors, fonts } from "@/theme/tokens";

/**
 * Yonetimin dort ana alani sekmede; detay ve basvuru ekranlari sekme cubugunun
 * ustunde Stack'te acilir. Gelen kutusu rozeti genel bakisin onbelleginden okunur
 * (ayri istek yok).
 */
export default function AdminTabsLayout() {
  const { t } = useTranslation();
  const overview = useAdminOverview();
  const unread = overview.data?.attention.unreadMessages ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("admin.tabs.overview"), tabBarIcon: ({ color }) => <LayoutGrid size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: t("admin.tabs.bookings"), tabBarIcon: ({ color }) => <Ticket size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="shops"
        options={{ title: t("admin.tabs.shops"), tabBarIcon: ({ color }) => <Store size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("admin.tabs.inbox"),
          tabBarIcon: ({ color }) => <Inbox size={20} color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, fontFamily: fonts.bodySemibold, fontSize: 11 },
        }}
      />
    </Tabs>
  );
}
