import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Camera, ChevronRight, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Card } from "@/components/ui";
import { usePartnerShop } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";

/**
 * "Dukkanini tamamla": fotografsiz ve saati hic girilmemis dukkanlar
 * (2026-11-18, prod'da 12'nin 9'u) misafire bos kart ve yanlis saat gosterir.
 * Eksik bir sey yoksa hic cizilmez.
 */
export function ShopSetupCard() {
  const { t } = useTranslation();
  const setup = usePartnerShop().data?.setup;
  if (!setup || (setup.hasPhoto && setup.hoursConfigured)) return null;

  const items = [
    !setup.hasPhoto && {
      key: "photo",
      icon: <Camera size={18} strokeWidth={1.75} color={colors.ink} />,
      title: t("setup.photoTitle"),
      body: t("setup.photoBody"),
      go: () => router.push("/partner/shop"),
    },
    !setup.hoursConfigured && {
      key: "hours",
      icon: <Clock size={18} strokeWidth={1.75} color={colors.ink} />,
      title: t("setup.hoursTitle"),
      body: t("setup.hoursBody"),
      go: () => router.push("/partner/schedule"),
    },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; title: string; body: string; go: () => void }[];

  return (
    <Card style={styles.card}>
      <AppText variant="heading">{t("setup.title")}</AppText>
      {items.map((it) => (
        <Pressable
          key={it.key}
          accessibilityRole="button"
          onPress={it.go}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
          <View style={styles.icon}>{it.icon}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyMedium">{it.title}</AppText>
            <AppText variant="caption">{it.body}</AppText>
          </View>
          <ChevronRight size={18} color={colors.inkMuted} />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, borderColor: colors.brand, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderRadius: radius.control },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
