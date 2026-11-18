import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Luggage, QrCode, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, fonts, shadow } from "@/theme/tokens";

/**
 * Esnafin uc ana alani: Emanetler, ortada buyuk "QR okut" (gun icindeki asil is), Dukkanim.
 * Profil ve hesap ayarlari Dukkanim'in altinda ve Emanetler'in sag ustundeki avatarda;
 * dorduncu sekme kalabaligi kaldirildi. Detay, muhur, kazanc, ayar ekranlari cubugun ustunde.
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
        options={{ title: t("tabs.storage"), tabBarIcon: ({ color }) => <Luggage size={20} color={color} /> }}
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
