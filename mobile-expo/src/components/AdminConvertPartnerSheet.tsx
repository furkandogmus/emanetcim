import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { AppText, Banner, Button } from "@/components/ui";
import { convertUserToPartner, isConvertFormValid } from "@/lib/admin-user-actions";
import { errorMessage } from "@/lib/errors";
import type { AdminConvertPartnerInput, AdminConvertPartnerResponse, AdminUserDetail } from "@/lib/types";
import { space } from "@/theme/tokens";

const empty = (u: AdminUserDetail): AdminConvertPartnerInput => ({
  phone: u.phone ?? "",
  shopName: "",
  shopAddress: "",
  city: "",
  district: "",
  location: "",
});

/**
 * Misafiri esnafa cevir (web `/admin/partners/new?fromUser=`). Kural sunucuda
 * (`AdminUserService.convertGuestToPartner`); sifresiz hesapta donen bag paylasilir.
 */
export function AdminConvertPartnerSheet({
  visible,
  onClose,
  user,
  label,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  user: AdminUserDetail;
  label: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AdminConvertPartnerInput>(() => empty(user));
  const [result, setResult] = useState<AdminConvertPartnerResponse | null>(null);
  const convert = useMutation({
    mutationFn: () => convertUserToPartner(user.id, form),
    onSuccess: (res) => {
      setResult(res);
      onDone();
    },
  });
  const set = (k: keyof AdminConvertPartnerInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const close = () => {
    if (convert.isPending) return;
    onClose();
    setResult(null);
    setForm(empty(user));
    convert.reset();
  };

  return (
    <Sheet visible={visible} onClose={close}>
      {result ? (
        <View style={{ gap: space.lg }}>
          <AppText variant="heading" accessibilityRole="header">
            {t("admin.leadConvertDoneTitle")}
          </AppText>
          {result.resetUrl ? (
            <>
              <AppText variant="caption">{t("admin.leadConvertResetBody")}</AppText>
              <Button
                variant="secondary"
                title={t("admin.leadConvertShareLink")}
                onPress={() =>
                  void Share.share({
                    message: t("admin.leadConvertShareMessage", { name: label, url: result.resetUrl }),
                  }).catch(() => undefined)
                }
              />
            </>
          ) : null}
          <Button
            title={t("admin.leadConvertOpenShop")}
            onPress={() => {
              const id = result.shopId;
              close();
              router.push(`/admin/shop/${id}`);
            }}
          />
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <AppText variant="heading" accessibilityRole="header">
            {t("adminParityD1.users.convertTitle", { name: label })}
          </AppText>
          <AppText variant="caption">{t("adminParityD1.users.convertBody")}</AppText>
          <Field
            label={t("admin.leadConvertPhone")}
            value={form.phone}
            onChangeText={set("phone")}
            keyboardType="phone-pad"
            placeholder="05xx xxx xx xx"
            editable={!convert.isPending}
          />
          <Field
            label={t("admin.leadConvertShopName")}
            value={form.shopName}
            onChangeText={set("shopName")}
            editable={!convert.isPending}
          />
          <Field
            label={t("admin.leadConvertAddress")}
            value={form.shopAddress}
            onChangeText={set("shopAddress")}
            multiline
            editable={!convert.isPending}
          />
          <View style={styles.row}>
            <Field label={t("admin.leadConvertCity")} value={form.city ?? ""} onChangeText={set("city")} style={{ flex: 1 }} />
            <Field
              label={t("admin.leadConvertDistrict")}
              value={form.district ?? ""}
              onChangeText={set("district")}
              style={{ flex: 1 }}
            />
          </View>
          <Field
            label={t("admin.leadConvertLocation")}
            hint={t("admin.leadConvertLocationHint")}
            value={form.location}
            onChangeText={set("location")}
            autoCapitalize="none"
            placeholder="41.0151, 28.9795"
            editable={!convert.isPending}
          />
          {convert.error ? <Banner tone="danger" body={errorMessage(convert.error, "adminParityD1.users")} /> : null}
          <Button
            title={t("adminParityD1.users.convertSubmit")}
            loading={convert.isPending}
            disabled={!isConvertFormValid(form) || convert.isPending}
            onPress={() => convert.mutate()}
          />
          <Button variant="ghost" title={t("common.cancel")} disabled={convert.isPending} onPress={close} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
});
