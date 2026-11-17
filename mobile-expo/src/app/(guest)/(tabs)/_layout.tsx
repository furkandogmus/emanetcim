import { Tabs } from "expo-router";
import { Compass, Ticket, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { isActiveBooking, useMyBookings } from "@/lib/queries";
import { colors, fonts } from "@/theme/tokens";

/**
 * Misafirin uc ana alani. Arama, harita, dukkan, odeme ve bilet sekme cubugunun
 * ustunde Stack'te acilir. Rozet: dukkana gidecek ya da dukkanda bekleyen emanet sayisi.
 */
export default function GuestTabsLayout() {
  const { t } = useTranslation();
  const active = useMyBookings().data?.filter((b) => isActiveBooking(b)).length ?? 0;

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
        name="home"
        options={{ title: t("tabs.explore"), tabBarIcon: ({ color }) => <Compass size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t("tabs.bookings"),
          tabBarIcon: ({ color }) => <Ticket size={20} color={color} />,
          tabBarBadge: active > 0 ? active : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, fontFamily: fonts.bodySemibold, fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t("tabs.profile"), tabBarIcon: ({ color }) => <User size={20} color={color} /> }}
      />
    </Tabs>
  );
}
