import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * Yazilan metin burada tutulur: her tusta liste degil yalnizca kutu yeniden cizilir.
 * `onSearch` yazma durduktan 300 ms sonra cagrilir; `onSearch` kararli olmali (useCallback / setState).
 */
export function SearchBox({ placeholder, onSearch }: { placeholder: string; onSearch: (q: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  useEffect(() => {
    const id = setTimeout(() => onSearch(text), 300);
    return () => clearTimeout(id);
  }, [text, onSearch]);

  return (
    <View style={styles.search}>
      <Search size={18} color={colors.inkMuted} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={styles.input}
      />
      {text ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.clear")} hitSlop={13} onPress={() => setText("")}>
          <X size={18} color={colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: space.sm },
});
