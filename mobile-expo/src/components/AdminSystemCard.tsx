import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { TonePill } from "@/components/TonePill";
import { AppText } from "@/components/ui";
import { installedBinaryVersion } from "@/lib/app-update";
import { systemHeadline } from "@/lib/admin-system";
import { useAdminSystem } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";
import { flipInRtl } from "@/lib/rtl";

const LEVEL_TONE = { ok: "ok", warning: "warning", error: "danger" } as const;

/**
 * Yonetici ozetinde surum + saglik satiri; dokununca "Sistem" ekrani. Yuklenemezse
 * yalniz uygulama surumu yazar: ozetin geri kalanini bekletmez.
 */
export function AdminSystemCard() {
  const { t } = useTranslation();
  const query = useAdminSystem();
  const data = query.data;
  const level = data ? systemHeadline(data) : null;
  const versions = [
    t("adminSystem.cardApp", { version: installedBinaryVersion() ?? "—" }),
    data ? t("adminSystem.cardServer", { version: data.serverVersion }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${t("adminSystem.title")}: ${level ? t(`adminSystem.level.${level}`) : ""}`}
      onPress={() => router.push("/admin/system")}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.top}>
          <AppText variant="bodyMedium">{t("adminSystem.title")}</AppText>
          {level ? <TonePill tone={LEVEL_TONE[level]} label={t(`adminSystem.level.${level}`)} /> : null}
        </View>
        <AppText variant="caption" style={{ fontSize: 13 }} numberOfLines={1}>
          {versions}
        </AppText>
        {data && data.enforcedStale > 0 ? (
          <AppText variant="caption" style={{ fontSize: 13, color: colors.danger }}>
            {t("adminSystem.jobsStale", { count: data.enforcedStale })}
          </AppText>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.inkMuted} style={flipInRtl} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
});
