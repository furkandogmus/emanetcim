import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ReferralCard } from "@/components/ReferralCard";
import { StackHeader } from "@/components/StackHeader";
import { colors, space } from "@/theme/tokens";

export default function PartnerReferralScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("referral.title")} />
      <ScrollView contentContainerStyle={styles.content}>
        <ReferralCard audience="partner" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  content: { padding: space.xl, gap: space.lg },
});
