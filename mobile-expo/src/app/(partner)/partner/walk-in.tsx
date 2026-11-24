import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card, Chip } from "@/components/ui";
import { Field } from "@/components/Field";
import { errorMessage } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { SITE_ORIGIN } from "@/lib/images";
import { languageInfo } from "@/lib/languages";
import { useCreateWalkIn, usePartnerDashboard } from "@/lib/queries";
import { walkInRequest, WALK_IN_PICKUP_HOURS } from "@/lib/walk-in";
import type { WalkInResult } from "@/lib/types";
import { colors, fonts, space } from "@/theme/tokens";

/**
 * Kapidan gelen misafir (web paneldeki "Kapidan gelen misafir" ile ayni servis): tezgahta
 * uygulamasiz misafir icin rezervasyon acilir ve valiz hemen teslim alinir. Muhur zorunluysa
 * rezervasyon acilir ve normal teslim ekranina gecilir.
 */
export default function WalkInScreen() {
  const { t, i18n } = useTranslation();
  const dashboard = usePartnerDashboard();
  const shopId = dashboard.data?.shop.id ?? null;
  const create = useCreateWalkIn(shopId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bags, setBags] = useState("1");
  const [hours, setHours] = useState<number>(4);
  const [terms, setTerms] = useState(false);
  const [done, setDone] = useState<WalkInResult | null>(null);
  // Ekran basina tek anahtar: zaman asimindan sonra tekrar basmak ayni rezervasyonu doner.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const openSite = (path: string) =>
    void Linking.openURL(`${SITE_ORIGIN}/${languageInfo(i18n.language).site}/${path}`).catch(() => undefined);

  const req = walkInRequest({ name, phone, email, bags, hours, terms });

  function submit() {
    if (!req || !shopId || create.isPending) return;
    create.mutate({ ...req, idempotencyKey }, {
      onSuccess: (r) => {
        if (r.needsCheckIn) {
          // Muhur ya da saat istisnasi: rezervasyon acik, teslim normal ekrandan.
          router.replace(`/partner/${r.bookingId}`);
          return;
        }
        setDone(r);
      },
    });
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StackHeader title={t("walkIn.title")} />
        <ScrollView contentContainerStyle={[styles.content, { alignItems: "center" }]}>
          <AppText variant="heading">{t("walkIn.doneTitle")}</AppText>
          <AppText variant="caption">{t("walkIn.shortCodeLabel")}</AppText>
          <AppText style={styles.code} accessibilityLabel={`${t("walkIn.shortCodeLabel")} ${done.shortCode}`}>
            {done.shortCode}
          </AppText>
          {done.qrCodeToken ? (
            <View style={styles.qr} accessible accessibilityLabel={t("walkIn.qrAlt")}>
              <QRCode value={done.qrCodeToken} size={200} color={colors.ink} backgroundColor={colors.surface} />
            </View>
          ) : null}
          <AppText variant="caption" style={{ textAlign: "center" }}>
            {done.emailQueued ? t("walkIn.emailSent") : t("walkIn.photoHint")}
          </AppText>
          <Button title={t("walkIn.finish")} onPress={() => router.back()} style={{ alignSelf: "stretch" }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("walkIn.title")} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="caption">{t("walkIn.lead")}</AppText>
        <Card style={{ gap: space.md }}>
          <Field label={t("walkIn.guestName")} value={name} onChangeText={setName} maxLength={80} autoCorrect={false} />
          <Field
            label={t("walkIn.guestPhone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={24}
          />
          <Field
            label={t("walkIn.guestEmail")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
            hint={t("walkIn.contactHint")}
          />
          <Field
            label={t("walkIn.bagCount")}
            value={bags}
            onChangeText={(v) => setBags(v.replace(/\D/g, "").slice(0, 2))}
            keyboardType="number-pad"
          />
          <View style={{ gap: space.sm }}>
            <AppText variant="label">{t("walkIn.pickupIn")}</AppText>
            <View style={styles.chips}>
              {WALK_IN_PICKUP_HOURS.map((h) => (
                <Chip key={h} label={t("walkIn.hours", { count: h })} selected={hours === h} onPress={() => setHours(h)} soft />
              ))}
            </View>
          </View>
        </Card>

        <Card style={styles.terms}>
          <Switch
            accessibilityLabel={t("walkIn.termsConfirm")}
            value={terms}
            onValueChange={setTerms}
            trackColor={{ true: colors.accent, false: colors.borderStrong }}
            thumbColor={colors.white}
          />
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="caption">{t("walkIn.termsConfirm")}</AppText>
            <View style={styles.links}>
              <Button variant="ghost" title={t("walkIn.termsLink")} onPress={() => openSite("terms")} />
              <Button variant="ghost" title={t("walkIn.kvkkLink")} onPress={() => openSite("kvkk")} />
            </View>
          </View>
        </Card>

        <AppText variant="caption">{t("walkIn.payAtShop")}</AppText>
        {create.isError ? <Banner tone="danger" body={errorMessage(create.error, "walkIn")} /> : null}
        <Button title={t("walkIn.submit")} loading={create.isPending} disabled={!req || !shopId} onPress={submit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl * 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  terms: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  links: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  code: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, letterSpacing: 4, color: colors.ink },
  qr: { padding: space.md, backgroundColor: colors.surface, borderRadius: 16 },
});
