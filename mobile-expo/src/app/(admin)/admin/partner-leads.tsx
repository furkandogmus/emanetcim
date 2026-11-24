import { useState } from "react";
import { FlatList, Linking, RefreshControl, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { StackHeader } from "@/components/StackHeader";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { ToggleRow } from "@/components/ToggleRow";
import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { notify } from "@/lib/notify";
import { telUrl } from "@/lib/phone";
import { keys, useAdminPartnerLeads } from "@/lib/queries";
import { isBlockingError } from "@/lib/query-view";
import type { AdminPartnerLead, LeadConversion } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

type Form = NonNullable<AdminPartnerLead["draft"]>;

/** Eski sunucu `draft` gondermez: on dolgu ayni alanlardan kurulur. */
function draftOf(lead: AdminPartnerLead): Form {
  return (
    lead.draft ?? {
      ownerName: lead.fullName,
      phone: lead.phone,
      email: "",
      shopName: lead.shopName ?? "",
      shopAddress: lead.address,
      city: "",
      district: "",
      location: "",
    }
  );
}

/**
 * Esnaf on kayitlari: web `/admin/partner-leads` ile ayni liste ve "iletisime gecildi"
 * isareti (`PartnerLeadService.setContacted`). "Esnaf hesabina
 * cevir" paneli on kayittan dolar; kural sunucuda (`PartnerLeadService.convertToPartner`).
 */
export default function AdminPartnerLeadsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useAdminPartnerLeads();
  const [lead, setLead] = useState<AdminPartnerLead | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [activate, setActivate] = useState(false);
  const [result, setResult] = useState<LeadConversion | null>(null);

  const convert = useMutation({
    mutationFn: (vars: { id: string; form: Form; activate: boolean }) =>
      api<LeadConversion>(`/admin/partner-leads/${vars.id}/convert`, {
        method: "POST",
        body: { ...vars.form, activate: vars.activate },
      }),
    onSuccess: (res) => {
      setResult(res);
      for (const k of ["partner-leads", "applications", "overview", "shops"]) {
        void queryClient.invalidateQueries({ queryKey: [...keys.admin, k] });
      }
    },
  });

  const contacted = useMutation({
    mutationFn: (vars: { id: string; contacted: boolean }) =>
      api<{ ok: true }>(`/admin/partner-leads/${encodeURIComponent(vars.id)}`, {
        method: "PATCH",
        body: { contacted: vars.contacted },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...keys.admin, "partner-leads"] }),
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "adminParityD1.leads")),
  });

  function open(l: AdminPartnerLead) {
    setLead(l);
    setForm(draftOf(l));
    setActivate(false);
    setResult(null);
    convert.reset();
  }
  function close() {
    if (convert.isPending) return;
    setLead(null);
    setForm(null);
  }
  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const canSubmit = !!form && form.location.trim().length > 0 && form.phone.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader title={t("admin.partnerLeads")} />
      <StaleQueryBanner query={query} />

      {query.isLoading ? (
        <Loading />
      ) : isBlockingError(query) ? (
        <CenterMessage
          title={errorMessage(query.error)}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[styles.list, !query.data?.length && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
          }
          ListEmptyComponent={<CenterMessage title={t("admin.partnerLeadsEmpty")} />}
          renderItem={({ item }) => (
            <Card style={{ gap: space.md }}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="heading">{item.shopName || item.fullName}</AppText>
                  <AppText variant="caption">
                    {item.shopName ? `${item.fullName} · ` : ""}
                    {formatDay(item.createdAt)}
                  </AppText>
                  <AppText variant="caption">{item.address}</AppText>
                  {item.contacted && !item.converted ? (
                    <AppText variant="caption" style={{ color: colors.accent }}>
                      {t("adminParityD1.leads.contactedTag")}
                    </AppText>
                  ) : null}
                </View>
                <IconButton
                  label={t("admin.call")}
                  onPress={() => void Linking.openURL(telUrl(item.phone, item.whatsapp)).catch(() => undefined)}
                >
                  <Phone size={18} color={colors.ink} />
                </IconButton>
              </View>
              {item.converted ? (
                <Button
                  variant="secondary"
                  title={t("admin.partnerLeadsConverted")}
                  disabled={!item.convertedShopId}
                  onPress={() => item.convertedShopId && router.push(`/admin/shop/${item.convertedShopId}`)}
                />
              ) : (
                <>
                  <Button
                    variant="secondary"
                    title={item.contacted ? t("adminParityD1.leads.undoContacted") : t("adminParityD1.leads.markContacted")}
                    loading={contacted.isPending && contacted.variables?.id === item.id}
                    disabled={contacted.isPending}
                    onPress={() => contacted.mutate({ id: item.id, contacted: !item.contacted })}
                  />
                  <Button title={t("admin.partnerLeadsConvert")} onPress={() => open(item)} />
                </>
              )}
            </Card>
          )}
        />
      )}

      <Sheet visible={!!lead && !!form} onClose={close}>
        {result ? (
          <View style={{ gap: space.lg }}>
            <AppText variant="heading" accessibilityRole="header">
              {result.alreadyConverted ? t("admin.leadConvertAlready") : t("admin.leadConvertDoneTitle")}
            </AppText>
            {result.activated ? (
              <Banner tone="success" body={t("admin.leadConvertActivated")} />
            ) : result.activationFailed ? (
              <Banner tone="warning" body={t("admin.leadConvertActivationFailed")} />
            ) : null}
            {result.resetUrl ? (
              <>
                <AppText variant="caption">{t("admin.leadConvertResetBody")}</AppText>
                <Button
                  variant="secondary"
                  title={t("admin.leadConvertShareLink")}
                  onPress={() =>
                    void Share.share({
                      message: t("admin.leadConvertShareMessage", { name: form?.ownerName ?? "", url: result.resetUrl }),
                    }).catch(() => undefined)
                  }
                />
              </>
            ) : null}
            {result.shopId ? (
              <Button
                title={t("admin.leadConvertOpenShop")}
                onPress={() => {
                  const id = result.shopId;
                  close();
                  router.push(`/admin/shop/${id}`);
                }}
              />
            ) : null}
          </View>
        ) : form ? (
          <View style={{ gap: space.md }}>
            <AppText variant="heading" accessibilityRole="header">
              {t("admin.leadConvertTitle")}
            </AppText>
            <AppText variant="caption">{t("admin.leadConvertBody")}</AppText>
            <Field label={t("admin.leadConvertOwner")} value={form.ownerName} onChangeText={set("ownerName")} />
            <Field
              label={t("admin.leadConvertPhone")}
              value={form.phone}
              onChangeText={set("phone")}
              keyboardType="phone-pad"
              placeholder="05xx xxx xx xx"
            />
            <Field
              label={t("admin.leadConvertEmail")}
              value={form.email}
              onChangeText={set("email")}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field label={t("admin.leadConvertShopName")} value={form.shopName} onChangeText={set("shopName")} />
            <Field label={t("admin.leadConvertAddress")} value={form.shopAddress} onChangeText={set("shopAddress")} multiline />
            <View style={styles.row}>
              <Field label={t("admin.leadConvertCity")} value={form.city} onChangeText={set("city")} style={{ flex: 1 }} />
              <Field label={t("admin.leadConvertDistrict")} value={form.district} onChangeText={set("district")} style={{ flex: 1 }} />
            </View>
            <Field
              label={t("admin.leadConvertLocation")}
              hint={t("admin.leadConvertLocationHint")}
              value={form.location}
              onChangeText={set("location")}
              autoCapitalize="none"
              placeholder="41.0151, 28.9795"
            />
            <ToggleRow
              label={t("admin.leadConvertActivate")}
              hint={t("admin.leadConvertActivateHint")}
              value={activate}
              onChange={setActivate}
              last
            />
            {convert.error ? <Banner tone="danger" body={errorMessage(convert.error, "admin")} /> : null}
            <Button
              title={t("admin.leadConvertSubmit")}
              loading={convert.isPending}
              disabled={!canSubmit || convert.isPending}
              onPress={() => lead && form && convert.mutate({ id: lead.id, form, activate })}
            />
          </View>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
});
