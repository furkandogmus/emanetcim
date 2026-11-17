import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, IconButton } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

/**
 * Ust uste acilan ekranlarin tek basligi: geri dugmesi, ortada baslik (+ istege bagli alt
 * satir), sagda dugmeyle ayni genislikte bosluk. Eskiden dort ayri bicim vardi ve 44'luk
 * bosluk 40'lik dugmeyle eslesmedigi icin baslik 2 px kayiyordu.
 */
export function StackHeader({ title, subtitle, onBack }: { title?: string; subtitle?: string; onBack?: () => void }) {
  const { t } = useTranslation();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")));
  return (
    <View style={styles.header}>
      <IconButton label={t("common.back")} onPress={back}>
        <ArrowLeft size={20} color={colors.ink} />
      </IconButton>
      <View style={styles.title}>
        {title ? (
          <AppText variant="heading" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    gap: space.sm,
  },
  title: { flex: 1, alignItems: "center", gap: 2 },
  spacer: { width: 40 },
});
