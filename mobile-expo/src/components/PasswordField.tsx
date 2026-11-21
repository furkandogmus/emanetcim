import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { TextInput, TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/Field";
import { colors } from "@/theme/tokens";

/** Sifre kutusu + goster/gizle: yanlis yazilmis sifreyi gormeden tekrar tekrar denemek yerine. */
export const PasswordField = forwardRef<TextInput, TextInputProps>(function PasswordField(props, ref) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Input
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!visible}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        hitSlop={8}
        onPress={() => setVisible((v) => !v)}
        style={styles.toggle}
      >
        {visible ? <EyeOff size={20} color={colors.inkSecondary} /> : <Eye size={20} color={colors.inkSecondary} />}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  input: { paddingRight: 48 },
  toggle: { position: "absolute", right: 0, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" },
});
