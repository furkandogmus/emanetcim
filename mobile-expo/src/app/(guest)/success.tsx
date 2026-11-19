import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LuggageTag } from "@/components/Illustrations";
import { useTranslation } from "react-i18next";

import { MapPin } from "lucide-react-native";

import { AppText, Button, Card } from "@/components/ui";
import { formatDay, formatTime } from "@/lib/format";
import { registerForPush } from "@/lib/push";
import { useBooking } from "@/lib/queries";
import { colors, space } from "@/theme/tokens";

export default function SuccessScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();
  // Ozet karti: "rezervasyonun hazir" tek basina neyin, nerede, ne zaman oldugunu soylemiyordu.
  const booking = useBooking(bookingId ?? "").data;

  // Bildirim izni burada istenir: misafir az once rezervasyon yapti, check-in ve
  // hatirlatma bildiriminin neden geldigi belli. Ekran oturduktan sonra sorulur.
  useEffect(() => {
    const id = setTimeout(() => void registerForPush({ prompt: true }).catch(() => undefined), 900);
    return () => clearTimeout(id);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <LuggageTag size={104} stamp />
        <AppText variant="title" style={{ textAlign: "center" }}>
          {t("success.title")}
        </AppText>
        <AppText variant="body" style={{ textAlign: "center", color: colors.inkSecondary }}>
          {t("success.body")}
        </AppText>
        {booking ? (
          <Card style={styles.summary}>
            <AppText variant="heading">{booking.shopName}</AppText>
            <AppText variant="bodyMedium">
              {t("success.dropOffAt", { day: formatDay(booking.checkInTime), time: formatTime(booking.checkInTime) })}
            </AppText>
            {booking.shopAddress ? (
              <View style={styles.address}>
                <MapPin size={14} color={colors.inkMuted} />
                <AppText variant="caption" style={{ flex: 1 }}>
                  {booking.shopAddress}
                </AppText>
              </View>
            ) : null}
          </Card>
        ) : null}
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
  summary: { alignSelf: "stretch", gap: space.sm },
  address: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  icon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
