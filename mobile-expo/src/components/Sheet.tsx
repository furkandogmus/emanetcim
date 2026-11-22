import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { colors, radius, space } from "@/theme/tokens";

/**
 * Alttan acilan panel kabugu: karartma, tutamac, guvenli alan. Bilgi paneli, dil ve
 * dukkan secimi bunun icine kendi icerigini koyar; sistem Alert'i yerine uygulamanin dili.
 */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Karartma kokte: arka plan Pressable'inda Android'de ayri pencere katmaninda cizilmiyordu. */}
      {/* Not alani olan panelde (ReasonSheet) klavye onay dugmesini kapatmasin. */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,25,23,0.45)" },
  sheet: {
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
});
