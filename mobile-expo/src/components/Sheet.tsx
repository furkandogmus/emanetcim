import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { colors, radius, space } from "@/theme/tokens";

/*
  Android'de de "padding": RN 0.86 Modal'i (ReactModalHostView.kt) dialog penceresine
  SOFT_INPUT_ADJUST_RESIZE koyuyor, ama navigationBarTranslucent ile ayni pencerede
  `enableEdgeToEdge()` -> `setDecorFitsSystemWindows(false)` cagiriyor. Bu durumda
  Android adjustResize'i uygulamaz (IME inset'i uygulamaya birakilir), pencere kuculmez;
  yani KAV'in dolgusu ikinci bir kaydirma olmaz. `undefined` olsaydi onay dugmesi
  klavyenin altinda kalirdi.
*/
const KAV_BEHAVIOR = "padding" as const;

/** iOS klavye animasyonundan once haber verir; Android yalnizca "did" olaylarini yayar. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * Alttan acilan panel kabugu: karartma, tutamac, guvenli alan. Bilgi paneli, dil ve
 * dukkan secimi bunun icine kendi icerigini koyar; sistem Alert'i yerine uygulamanin dili.
 * Icerik ekrana sigmazsa (kucuk ekran + acik klavye) panel kaydirilir; sigarsa
 * kaydirma cubugu yok ve gorunum eskisiyle ayni.
 */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
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
      <KeyboardAvoidingView style={styles.root} behavior={KAV_BEHAVIOR}>
        <Pressable
          style={[styles.backdrop, { minHeight: insets.top + space.xl }]}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
        />
        {/* Klavye acikken alt guvenli alan klavyenin altinda kalir; dolgu olarak tutulursa bosluk olur. */}
        <View
          style={[styles.sheet, { paddingBottom: keyboardOpen ? space.md : insets.bottom + space.xl }]}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,25,23,0.45)" },
  backdrop: { flex: 1 },
  sheet: {
    flexShrink: 1,
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: space.lg },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
});
