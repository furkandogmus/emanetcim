import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { colors } from "@/theme/tokens";

/**
 * Apple'in kendi dugmesi (HIG zorunlu kiliyor: metni ve logoyu Apple cizer, dile gore
 * "Apple ile devam et"). Google dugmesiyle ayni yukseklik ve hap bicimi.
 */
export function AppleButton({ loading, disabled, onPress }: { loading?: boolean; disabled?: boolean; onPress: () => void }) {
  const off = !!disabled || !!loading;
  return (
    <View style={[styles.wrap, off && styles.disabled]} pointerEvents={off ? "none" : "auto"}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={27}
        style={styles.button}
        onPress={onPress}
      />
      {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.white} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 54 },
  button: { width: "100%", height: 54 },
  disabled: { opacity: 0.6 },
});
