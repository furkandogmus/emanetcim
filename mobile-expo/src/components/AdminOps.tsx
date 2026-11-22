import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { AppText, Banner, Button, CenterMessage, Loading } from "@/components/ui";
import { adminOpsErrorMessage, canMutateAdminOps, confirmationMatches } from "@/lib/admin-ops";
import { isBlockingError, type QueryViewState } from "@/lib/query-view";
import { colors, radius, space } from "@/theme/tokens";

type ShellQuery = QueryViewState & {
  isLoading: boolean;
  isRefetching: boolean;
  refetch: () => unknown;
};

/** Yonetim araclari ekran iskeleti: baslik, yukleme/hata, yenile ve goruntuleme uyarisi. */
export function AdminOpsScreen({ title, query, children }: { title: string; query: ShellQuery; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={title} />
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : query.data === undefined || isBlockingError(query) ? (
        <CenterMessage
          title={adminOpsErrorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => void query.refetch()} />}
        />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />
            }
          >
            {canMutateAdminOps() ? null : <Banner tone="warning" body={t("adminOps.impersonating")} />}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

/** Riskli degisiklik icin yazarak onay: dugme ifade birebir yazilana kadar kapali. */
export function TypedConfirmSheet(props: {
  visible: boolean;
  body: string;
  /** Degisenlerin eski -> yeni listesi gibi ek icerik. */
  details?: ReactNode;
  phrase: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (typed: string) => void;
  onClose: () => void;
}) {
  // Icerik yalniz acikken kurulur: her acilis bos alanla baslar, onceki onay tekrar kullanilmaz.
  return (
    <Sheet visible={props.visible} onClose={props.onClose}>
      {props.visible ? <TypedConfirmBody {...props} /> : null}
    </Sheet>
  );
}

function TypedConfirmBody({
  body,
  details,
  phrase,
  loading,
  error,
  onConfirm,
  onClose,
}: {
  body: string;
  details?: ReactNode;
  phrase: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (typed: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const ok = confirmationMatches(typed, phrase);
  return (
    <View style={{ gap: space.lg }} testID="typed-confirm">
      <AppText variant="heading">{t("adminOps.confirm.title")}</AppText>
      <AppText variant="body">{body}</AppText>
      {details}
      <Field
        label={t("adminOps.confirm.inputLabel")}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        hint={typed.trim() && !ok ? t("adminOps.confirm.mismatch") : undefined}
      />
      {error ? <Banner tone="danger" body={error} /> : null}
      <Button title={t("adminOps.confirm.button")} disabled={!ok} loading={loading} onPress={() => onConfirm(typed.trim())} />
      <Button variant="secondary" title={t("common.cancel")} onPress={onClose} />
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <AppText variant="label">{children}</AppText>;
}

export const opsStyles = StyleSheet.create({
  row: {
    gap: 4,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  meta: { fontSize: 13, fontVariant: ["tabular-nums"] },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.lg },
});
