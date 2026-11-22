import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { AppText, Banner, Button } from "@/components/ui";
import type { Choice } from "@/components/ChoiceSheet";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Geri alinamayan yonetim islemi icin neden paneli: istege bagli tek secimlik liste,
 * not alani ve yikici onay. Gecerlilik cagiranin isi (`canSubmit`); dugme o zamana
 * kadar kapali, istek suresince yukleniyor. Sunucu hatasi panelin icinde kalir ki
 * yazilan not kaybolmasin.
 */
export function ReasonSheet({
  visible,
  onClose,
  title,
  body,
  choices,
  selected,
  onSelect,
  note,
  onNoteChange,
  noteLabel,
  notePlaceholder,
  noteHint,
  confirmLabel,
  canSubmit,
  loading,
  error,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  choices?: Choice[];
  selected?: string | null;
  onSelect?: (value: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  noteLabel: string;
  notePlaceholder: string;
  noteHint?: string;
  confirmLabel: string;
  canSubmit: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={loading ? () => undefined : onClose}>
      <View style={{ gap: space.xs }}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="caption">{body}</AppText>
      </View>
      {choices ? (
        <View style={styles.group} accessibilityRole="radiogroup">
          {choices.map((c, i) => {
            const on = c.value === selected;
            return (
              <Pressable
                key={c.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, checked: on }}
                accessibilityLabel={c.label}
                onPress={() => onSelect?.(c.value)}
                style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: colors.surfaceMuted }]}
              >
                <AppText variant="bodyMedium" style={[{ flex: 1 }, on && { color: colors.accent }]}>
                  {c.label}
                </AppText>
                {on ? <Check size={20} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Field
        label={noteLabel}
        hint={noteHint}
        value={note}
        onChangeText={onNoteChange}
        placeholder={notePlaceholder}
        multiline
        maxLength={500}
        // Uzun notta alan buyumeye devam ederse onay dugmesi kucuk ekranda kayboluyordu.
        inputStyle={{ maxHeight: 140 }}
        editable={!loading}
      />
      {error ? <Banner tone="danger" body={error} /> : null}
      <View style={{ gap: space.sm }}>
        <Button variant="danger" title={confirmLabel} disabled={!canSubmit} loading={loading} onPress={onConfirm} />
        <Button variant="ghost" title={t("common.cancel")} disabled={loading} onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
