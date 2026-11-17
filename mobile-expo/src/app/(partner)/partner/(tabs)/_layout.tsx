import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { QrCode, Store, Ticket, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, fonts, shadow } from "@/theme/tokens";

/**
 * Esnafin dort ana alani. "QR okut" ortada ve buyuk: gun icindeki asil is misafirin
 * QR'ini okutmak. Detay, muhur, kazanc ve ayar ekranlari sekme cubugunun ustunde acilir.
 */
export default function PartnerTabsLayout() {
  const { t } = useTranslation();

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
        options={{ title: t("tabs.bookings"), tabBarIcon: ({ color }) => <Ticket size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t("scan.open"),
          // Kamera ekrani kendi tam ekran gorunumunu ister; cubuk orada da kalir ki cikis belli olsun.
          tabBarIcon: ({ focused }) => (
            <View style={[styles.scan, focused && { backgroundColor: colors.ink }]}>
              <QrCode size={22} color={colors.white} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: t("partner.myShop"), tabBarIcon: ({ color }) => <Store size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t("tabs.profile"), tabBarIcon: ({ color }) => <User size={20} color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scan: {
    width: 48,
    height: 48,
    marginTop: -16,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.floating,
  },
});
