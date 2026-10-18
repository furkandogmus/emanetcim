import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { AppText, Banner, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, usePartnerShopSettings } from "@/lib/queries";
import type { PartnerShopSettings } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, space } from "@/theme/tokens";

/**
 * Dukkan temel bilgileri + esnafin telefonu. Calisma saatleri burada degil,
 * `schedule` ekraninda: web formu da ayni ayrimi yapiyor ve gun bazli saat
 * kaydedilince `Shop.openingTime/closingTime` oradan yaziliyor.
 */
export default function PartnerSettingsScreen() {
  const { t } = useTranslation();
  const query = usePartnerShopSettings();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("shopSettings.title")}</AppText>
        <View style={{ width: 44 }} />
      </View>
      {query.isLoading ? (
        <Loading />
      ) : query.isError || !query.data ? (
        <CenterMessage
          title={errorMessage(query.error)}
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
  const [name, setName] = useState(shop.name);
  const [capacity, setCapacity] = useState(String(shop.capacity));
  const [price, setPrice] = useState(String(shop.pricePerDay));
  const [address, setAddress] = useState(shop.address ?? "");
  const [city, setCity] = useState(shop.city ?? "");
  const [district, setDistrict] = useState(shop.district ?? "");
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (body: { name: string; capacity: number; pricePerDay: number }) => {
      await api("/partner/shop", {
        method: "PUT",
        body: { ...body, address: address.trim(), city: city.trim(), district: district.trim() },
      });
      // Telefon yalnizca degistiyse: bos gondermek sunucuda numarayi SILER.
      const nextPhone = phone.trim();
      if (nextPhone !== (shop.phone ?? "")) {
        await api("/partner/phone", { method: "PUT", body: { phone: nextPhone || null } });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.partnerShop });
      notify(t("shopSettings.saved"));
    },
    onError: (e) => {
      // Dukkan kaydi telefondan once yapilir; telefon hatasinda bilgiler yine kaydedilmis olabilir.
      void queryClient.invalidateQueries({ queryKey: keys.partnerShop });
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
    setFormError(null);
    save.mutate({ name: name.trim(), capacity: cap, pricePerDay });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
          {t("shopSettings.phoneSection")}
        </AppText>
        <Field
          label={t("shopSettings.phone")}
          hint={t("shopSettings.phoneHint")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={t("shopSettings.phonePlaceholder")}
          maxLength={20}
        />

        {formError ? <Banner tone="danger" body={formError} /> : null}
        <Button title={t("shopSettings.save")} loading={save.isPending} onPress={submit} />
      </ScrollView>
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
  content: { padding: space.xl, gap: space.md },
  section: { marginTop: space.md },
  pair: { flexDirection: "row", gap: space.md },
});
