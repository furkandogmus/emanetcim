import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, CenterMessage, Chip } from "@/components/ui";
import { buildAffiliateApplication } from "@/lib/account-parity";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { useApplyAffiliate } from "@/lib/queries";
import { openSitePage } from "@/lib/site-page";
import type { AdminAffiliateType } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

const TYPES: AdminAffiliateType[] = ["airbnb_host", "hotel", "guide", "agency", "other"];

/** Araci basvurusu (web `/affiliates` formu, ayni servis). Basvuru hesaba baglanir; onayi yonetici verir. */
export default function AffiliateApplyScreen() {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;
  const apply = useApplyAffiliate(user?.id ?? null);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [type, setType] = useState<AdminAffiliateType | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (apply.isSuccess) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StackHeader title={t("affiliate.applyTitle")} />
        <CenterMessage
          title={t("affiliate.appliedTitle")}
          body={t("affiliate.appliedBody")}
          action={<Button title={t("affiliate.toPanel")} onPress={() => router.replace("/affiliate")} />}
        />
      </SafeAreaView>
    );
  }

  function submit() {
    setError(null);
    const r = buildAffiliateApplication({ displayName, type, email, phone, note });
    if (!r.ok) return setError(t(`affiliate.errors.${r.error}`));
    apply.mutate(r.body, { onError: (e) => setError(errorMessage(e, "affiliate")) });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("affiliate.applyTitle")} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="body" style={{ color: colors.inkSecondary }}>
            {t("affiliate.applyIntro")}
          </AppText>
          <Field
            label={t("affiliate.form.displayName")}
            hint={t("affiliate.form.displayNameHint")}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={120}
          />
          <View style={{ gap: space.sm }}>
            <AppText variant="label">{t("affiliate.form.type")}</AppText>
            <View style={styles.chips}>
              {TYPES.map((v) => (
                <Chip key={v} soft label={t(`affiliate.types.${v}`)} selected={type === v} onPress={() => setType(v)} />
              ))}
            </View>
          </View>
          <Field
            label={t("affiliate.form.email")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={320}
          />
          <Field
            label={t("affiliate.form.phone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={20}
          />
          <Field
            label={t("affiliate.form.note")}
            hint={t("affiliate.form.noteHint")}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
          />
          {error ? <Banner tone="danger" body={error} /> : null}
          <Button title={t("affiliate.submit")} loading={apply.isPending} onPress={submit} />
          <Button variant="ghost" title={t("affiliate.learnMore")} onPress={() => openSitePage("affiliates", i18n.language)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
