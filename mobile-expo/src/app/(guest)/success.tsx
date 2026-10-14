import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Button } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

export default function SuccessScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.icon}>
          <CircleCheck size={56} color={colors.success} />
        </View>
        <AppText variant="title" style={{ textAlign: "center" }}>
          {t("success.title")}
        </AppText>
        <AppText variant="body" style={{ textAlign: "center", color: colors.inkSecondary }}>
          {t("success.body")}
        </AppText>
      </View>
      <View style={{ gap: space.md }}>
        <Button
          title={t("success.viewBooking")}
          onPress={() => {
            // Arama/harita/detay yigini kapanir; geri tusu ana sayfaya doner.
            router.dismissAll();
            router.push(`/bookings/${bookingId}`);
          }}
        />
        <Button variant="secondary" title={t("success.home")} onPress={() => router.dismissAll()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: space.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg },
  icon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
