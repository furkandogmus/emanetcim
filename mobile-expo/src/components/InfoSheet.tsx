import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Sheet } from "@/components/Sheet";
import { AppText, Button } from "@/components/ui";
import { colors, radius, space } from "@/theme/tokens";

/**
 * Dokunulan seyin "neden simdi olmadigini" anlatip tek bir sonraki adimi gosteren panel.
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
  return (
    <Sheet visible={visible} onClose={onClose}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
