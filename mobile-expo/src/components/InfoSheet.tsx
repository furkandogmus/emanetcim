import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppText, Button } from "@/components/ui";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Alttan acilan kucuk bilgi paneli: Alert'in sistem kutusu yerine uygulamanin dilinde,
 * gorselli ve tek bir sonraki adimla. Dokunulan seyin "neden simdi olmadigini"
 * anlatip ne yapilacagini gosterir.
 */
export function InfoSheet({
  visible,
  onClose,
  art,
  title,
  body,
  actionLabel,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  art?: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
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
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          {art ? <View style={styles.art}>{art}</View> : null}
          <View style={{ gap: space.xs }}>
            <AppText variant="heading">{title}</AppText>
            <AppText variant="caption" style={{ fontSize: 15, lineHeight: 22 }}>
              {body}
            </AppText>
          </View>
          <View style={{ gap: space.sm }}>
            {actionLabel && onAction ? (
              <Button
                title={actionLabel}
                onPress={() => {
                  onClose();
                  onAction();
                }}
              />
            ) : null}
            <Button variant="ghost" title={t("common.close")} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Karartma kokte: arka plan Pressable'inda Android'de ayri pencere katmaninda cizilmiyordu.
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,25,23,0.45)" },
  backdrop: { flex: 1 },
  sheet: {
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  art: {
    alignSelf: "flex-start",
    width: 72,
    height: 72,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
