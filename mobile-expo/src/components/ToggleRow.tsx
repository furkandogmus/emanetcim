import { StyleSheet, Switch, View } from "react-native";

import { AppText } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

/**
 * Etiket + aciklama + anahtar satiri (admin bayraklari). Dukkan ekranindan
 * 2026-11-23'te tasindi: kullanici ekranindaki kum havuzu anahtari da ayni satiri kullanir.
 */
export function ToggleRow({
  label,
  hint,
  value,
  disabled,
  onChange,
  last,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggle, !last && styles.toggleDivider]}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyMedium">{label}</AppText>
        <AppText variant="caption" style={{ fontSize: 13 }}>
          {hint}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.borderStrong }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  toggleDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
