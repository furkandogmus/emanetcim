import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, CenterMessage, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { usePartnerShopSelection, withShop } from "@/lib/partner-shop";
import { errorMessage } from "@/lib/errors";
import { keys, usePartnerShopSettings } from "@/lib/queries";
import type { PartnerShopSettings, PartnerShopUpdateResult } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, space } from "@/theme/tokens";

/**
 * Dukkan temel bilgileri.
 * Telefon BURADA YOK: o alan hesabin giris numarasi; silinirse ya da yanlis yazilirsa
 * esnaf kendi hesabindan kilitlenir. Numara profil ekranindan degisir.
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
      {query.isLoading ? (
        <Loading />
      ) : query.isError || !query.data ? (
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
