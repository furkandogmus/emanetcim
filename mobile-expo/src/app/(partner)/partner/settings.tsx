import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, CenterMessage, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { usePartnerShopSelection, withShop } from "@/lib/partner-shop";
import { errorMessage } from "@/lib/errors";
import { keys, savePartnerPhone, usePartnerShopSettings } from "@/lib/queries";
import type { PartnerShopSettings, PartnerShopUpdateResult } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, space } from "@/theme/tokens";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { LinkGroup, LinkRow } from "@/components/LinkRow";
import { useAuth } from "@/lib/auth";
import { hasPin, phoneChange } from "@/lib/partner-parity";

/**
 * Dukkan temel bilgileri, konum pini ve SMS bildirim numarasi.
 * SMS numarasi hesabin giris numarasiyla AYNI alan (`User.phone`): ayri bir
 * dugmeyle ve kayitli numarayi degistirirken/silerken onayla kaydedilir; sunucu
 * baska giris yolu olmayan hesapta degisikligi zaten reddeder.
 * Calisma saatleri burada degil,
 * `schedule` ekraninda: web formu da ayni ayrimi yapiyor ve gun bazli saat
 * kaydedilince `Shop.openingTime/closingTime` oradan yaziliyor.
 */
export default function PartnerSettingsScreen() {
  const { t } = useTranslation();
  const query = usePartnerShopSettings();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StackHeader title={t("shopSettings.title")} />
      <StaleQueryBanner query={query} />
      {query.isLoading ? (
        <Loading />
      ) : !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "shopSettings")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <SettingsForm shop={query.data} />
      )}
    </SafeAreaView>
  );
}

/** Alanlar sunucudan gelen degerle bir kez kurulur; kayittan sonra sorgu tazelenir. */
function SettingsForm({ shop }: { shop: PartnerShopSettings }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [shopId] = usePartnerShopSelection();
  const [name, setName] = useState(shop.name);
  const [capacity, setCapacity] = useState(String(shop.capacity));
  const [price, setPrice] = useState(String(shop.pricePerDay));
  const [address, setAddress] = useState(shop.address ?? "");
  const [city, setCity] = useState(shop.city ?? "");
  const [district, setDistrict] = useState(shop.district ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const { impersonating } = useAuth();
  // Yonetici goruntuleme oturumunda giris numarasi sunucuda da 403: alan salt okunur.
  const phoneLocked = impersonating !== null;
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const savePhone = useMutation({
    mutationFn: (value: string | null) => savePartnerPhone(value),
    onSuccess: (res) => {
      setPhone(res.phone ?? "");
      void queryClient.invalidateQueries({ queryKey: keys.partnerShop });
      notify(t("partnerParity.smsPhoneSaved"));
    },
    onError: (e) => setPhoneError(errorMessage(e, "partnerParity")),
  });

  function submitPhone() {
    const change = phoneChange(shop.phone, phone);
    if (change.kind === "invalid") return setPhoneError(t("partnerParity.errors.invalid_tr_phone"));
    setPhoneError(null);
    if (change.kind === "none") return;
    if (!change.confirm) return savePhone.mutate(change.phone);
    const clearing = change.confirm === "clear";
    Alert.alert(
      t(clearing ? "partnerParity.smsPhoneClearTitle" : "partnerParity.smsPhoneChangeTitle"),
      t(clearing ? "partnerParity.smsPhoneClearBody" : "partnerParity.smsPhoneChangeBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.continue"), style: clearing ? "destructive" : "default", onPress: () => savePhone.mutate(change.phone) },
      ],
    );
  }

  const save = useMutation({
    mutationFn: async (body: { name: string; capacity: number; pricePerDay: number }) => {
      return await api<PartnerShopUpdateResult>(withShop("/partner/shop", shopId), {
        method: "PUT",
        body: { ...body, address: address.trim(), city: city.trim(), district: district.trim() },
      });
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: keys.partnerShop });
      // Degisiklik engellenmez, SONUCU soylenir: esnaf etkilenen misafirlere ulasabilsin.
      const impact = res?.impact;
      const warnings: string[] = [];
      if (impact && impact.bookingsOutsideHours > 0) {
        warnings.push(t("shopSettings.impactOutsideHours", { count: impact.bookingsOutsideHours }));
      }
      if (impact && impact.bagsOverCapacity > 0) {
        warnings.push(t("shopSettings.impactOverCapacity", { count: impact.bagsOverCapacity }));
      }
      if (warnings.length > 0) notify(t("shopSettings.impactTitle"), warnings.join("\n\n"));
      else notify(t("shopSettings.saved"));
    },
    onError: (e) => {
      notify(t("shopSettings.saveFailed"), errorMessage(e, "shopSettings"));
    },
  });

  function submit() {
    // Yalnizca bicim denetimi; araliklar (piyasa fiyatina gore) sunucunun isi.
    const cap = Number(capacity.trim());
    const pricePerDay = Number(price.trim().replace(",", "."));
    if (name.trim().length < 2) return setFormError(t("shopSettings.nameInvalid"));
    if (!Number.isInteger(cap) || cap < 1) return setFormError(t("shopSettings.capacityInvalid"));
    if (!Number.isFinite(pricePerDay) || pricePerDay < 1) return setFormError(t("shopSettings.priceInvalid"));
    // Bant sunucudan gelir (esnaf 250 yerine 2500 yazmasin); karar yine sunucuda.
    const range = shop.priceRange;
    if (range && (pricePerDay < range.min || pricePerDay > range.max)) {
      return setFormError(t("shopSettings.priceOutOfRange"));
    }
    setFormError(null);
    save.mutate({ name: name.trim(), capacity: cap, pricePerDay });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="label" style={styles.section}>
          {t("shopSettings.basics")}
        </AppText>
        <Field label={t("shopSettings.name")} value={name} onChangeText={setName} maxLength={200} />
        <View style={styles.pair}>
          <Field
            style={{ flex: 1 }}
            label={t("shopSettings.capacity")}
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            maxLength={5}
          />
          <Field
            style={{ flex: 1 }}
            label={t("shopSettings.price")}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            maxLength={9}
          />
        </View>
        <AppText variant="caption">{t("shopSettings.priceHint")}</AppText>
        {shop.priceRange ? (
          <AppText variant="caption">
            {t("shopSettings.priceRange", { min: shop.priceRange.min, max: shop.priceRange.max })}
          </AppText>
        ) : null}

        <AppText variant="label" style={styles.section}>
          {t("shopSettings.addressSection")}
        </AppText>
        <Field label={t("shopSettings.address")} value={address} onChangeText={setAddress} maxLength={500} multiline />
        <View style={styles.pair}>
          <Field style={{ flex: 1 }} label={t("shopSettings.district")} value={district} onChangeText={setDistrict} maxLength={100} />
          <Field style={{ flex: 1 }} label={t("shopSettings.city")} value={city} onChangeText={setCity} maxLength={100} />
        </View>
        <AppText variant="caption">{t("shopSettings.addressHint")}</AppText>

        <AppText variant="label" style={styles.section}>
          {t("partnerParity.locationSection")}
        </AppText>
        <AppText variant="caption">
          {hasPin(shop) ? t("partnerParity.locationSet") : t("partnerParity.locationMissing")}
        </AppText>
        <LinkGroup>
          <LinkRow
            label={hasPin(shop) ? t("partnerParity.locationEdit") : t("partnerParity.locationAdd")}
            onPress={() => router.push("/partner/location")}
          />
        </LinkGroup>

        <AppText variant="label" style={styles.section}>
          {t("partnerParity.smsPhoneSection")}
        </AppText>
        <Field
          label={t("partnerParity.smsPhoneLabel")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={t("partnerParity.smsPhonePlaceholder")}
          maxLength={20}
          editable={!phoneLocked}
          hint={phoneLocked ? t("partnerParity.smsPhoneLocked") : t("partnerParity.smsPhoneHint")}
        />
        {phoneError ? <Banner tone="danger" body={phoneError} /> : null}
        {!phoneLocked ? (
          <Button
            variant="secondary"
            title={t("partnerParity.smsPhoneSave")}
            loading={savePhone.isPending}
            onPress={submitPhone}
          />
        ) : null}

        {formError ? <Banner tone="danger" body={formError} /> : null}
      </ScrollView>
      {/* Uzun formda kaydet sayfanin dibinde kaybolmasin: her zaman gorunur alt cubuk. */}
      <View style={styles.footer}>
        <Button title={t("shopSettings.save")} loading={save.isPending} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  content: { padding: space.xl, gap: space.md, paddingBottom: space.xxl },
  section: { marginTop: space.lg, color: colors.ink, fontFamily: fonts.displayMedium, fontSize: 15 },
  footer: { padding: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  pair: { flexDirection: "row", gap: space.md },
});
