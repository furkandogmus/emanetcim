import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { ChevronDown, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ChoiceSheet } from "@/components/ChoiceSheet";
import { AppText } from "@/components/ui";
import { usePartnerShopSelection } from "@/lib/partner-shop";
import { usePartnerDashboard } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Cok dukkanli esnafin dukkan secimi: yana kayan cip seridi yerine tek dugme + liste
 * paneli. Uzun dukkan adlari kesilmez, dukkan sayisi artsa da ekran ayni kalir.
 * Tek dukkanli esnafta yalnizca dukkan adi yazar (secilecek bir sey yok).
 */
export function ShopSwitcher() {
  const { t } = useTranslation();
  const [, setShopId] = usePartnerShopSelection();
  const d = usePartnerDashboard().data;
  const [open, setOpen] = useState(false);
  if (!d) return null;
  const many = d.shops.length > 1;

  return (
    <>
      <Pressable
        accessibilityRole={many ? "button" : "text"}
        accessibilityLabel={many ? t("partner.switchShop", { shop: d.shop.name }) : d.shop.name}
        disabled={!many}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, !many && styles.single, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <Store size={16} color={colors.inkSecondary} />
        <AppText variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
          {d.shop.name}
        </AppText>
        {many ? <ChevronDown size={16} color={colors.inkSecondary} /> : null}
      </Pressable>
      <ChoiceSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t("partner.chooseShop")}
        choices={d.shops.map((s) => ({ value: s.id, label: s.name }))}
        selected={d.shop.id}
        onSelect={setShopId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  single: { borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0, minHeight: 0 },
});
