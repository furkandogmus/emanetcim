import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Sheet } from "@/components/Sheet";
import { AppText, Button, Chip } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { DEFAULT_FILTERS, SEARCH_SORTS, type SearchFilters } from "@/lib/search";
import { space } from "@/theme/tokens";

/** Gunluk taban fiyat basamaklari (varsayilan dukkan fiyati 250 TL). */
export const MAX_PRICE_STEPS = [200, 250, 300, 400] as const;
export const MIN_RATING_STEPS = [3, 4, 4.5] as const;

/**
 * Harita suzgec paneli (web `SearchClient` "Filtreler" ile ayni alanlar). Secimler
 * panelde taslak olarak tutulur; "Sonuclari goster" ile aramaya uygulanir, kapatmak vazgecer.
 */
export function SearchFiltersSheet({
  visible,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: SearchFilters;
  onApply: (f: SearchFilters) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Taslak acilista `value`dan kurulur: cagiran her acilista `key` degistirir.
  const [draft, setDraft] = useState(value);
  const set = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="title" style={{ fontSize: 20, lineHeight: 26 }}>
        {t("guestParity.filters")}
      </AppText>

      <Section title={t("guestParity.sortTitle")}>
        {SEARCH_SORTS.map((s) => (
          <Chip key={s} soft label={t(`guestParity.sort.${s}`)} selected={draft.sort === s} onPress={() => set({ sort: s })} />
        ))}
      </Section>

      <Section title={t("guestParity.amenitiesTitle")}>
        <Chip soft label={t("guestParity.cctv")} selected={draft.cctv} onPress={() => set({ cctv: !draft.cctv })} />
        <Chip soft label={t("guestParity.climate")} selected={draft.climate} onPress={() => set({ climate: !draft.climate })} />
        <Chip
          soft
          label={t("guestParity.largeItems")}
          selected={draft.largeItems}
          onPress={() => set({ largeItems: !draft.largeItems })}
        />
      </Section>

      <Section title={t("guestParity.maxPriceTitle")} hint={t("guestParity.maxPriceHint")}>
        <Chip soft label={t("guestParity.anyPrice")} selected={draft.maxPrice == null} onPress={() => set({ maxPrice: null })} />
        {MAX_PRICE_STEPS.map((p) => (
          <Chip
            key={p}
            soft
            label={t("guestParity.upTo", { price: formatMoney(p) })}
            selected={draft.maxPrice === p}
            onPress={() => set({ maxPrice: p })}
          />
        ))}
      </Section>

      <Section title={t("guestParity.minRatingTitle")}>
        <Chip soft label={t("guestParity.anyRating")} selected={draft.minRating === 0} onPress={() => set({ minRating: 0 })} />
        {MIN_RATING_STEPS.map((r) => (
          <Chip
            key={r}
            soft
            label={t("guestParity.ratingAtLeast", { rating: r })}
            selected={draft.minRating === r}
            onPress={() => set({ minRating: r })}
          />
        ))}
      </Section>

      <View style={styles.actions}>
        <Button variant="secondary" style={{ flex: 1 }} title={t("guestParity.clear")} onPress={() => setDraft(DEFAULT_FILTERS)} />
        <Button style={{ flex: 2 }} title={t("guestParity.showResults")} onPress={() => onApply(draft)} />
      </View>
    </Sheet>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{title}</AppText>
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  actions: { flexDirection: "row", gap: space.md },
});
