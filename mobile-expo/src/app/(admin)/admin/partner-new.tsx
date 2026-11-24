import { useCallback, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { Field } from "@/components/Field";
import { SearchBox } from "@/components/SearchBox";
import { Segmented } from "@/components/Segmented";
import { AppText, Banner, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { canMutateAdminOps } from "@/lib/admin-ops";
import {
  EMPTY_PARTNER_FORM,
  formFromGuest,
  partnerBody,
  partnerFormIssues,
  type GuestSource,
  type PartnerNewForm,
} from "@/lib/admin-partner-new";
import { errorMessage } from "@/lib/errors";
import { flattenPages } from "@/lib/paging";
import { keys, useAdminUsers } from "@/lib/queries";
import type { AdminPartnerCreated } from "@/lib/types";
import { colors, space } from "@/theme/tokens";

type Mode = "new" | "guest";

/**
 * Sifirdan esnaf + dukkan ac ya da misafir hesabini esnafa cevir. Govde web
 * `/admin/partners/new` ile ortak (`AdminPartnerCreateService`); dukkan kapali acilir
 * ve onay ekranindan gecmeden aramada gorunmez. `?fromUser=&name=&email=&phone=` ile
 * gelinirse dogrudan cevirme formu acilir (kullanici detayindan).
 */
export default function AdminPartnerNewScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ fromUser?: string; name?: string; email?: string; phone?: string }>();
  const initialGuest: GuestSource | null = params.fromUser
    ? { id: params.fromUser, name: params.name ?? null, email: params.email ?? null, phone: params.phone ?? null }
    : null;
  const [mode, setMode] = useState<Mode>(initialGuest ? "guest" : "new");
  const [guest, setGuest] = useState<GuestSource | null>(initialGuest);
  const [form, setForm] = useState<PartnerNewForm>(initialGuest ? formFromGuest(initialGuest) : EMPTY_PARTNER_FORM);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<AdminPartnerCreated | null>(null);
  const converting = mode === "guest";
  const issues = partnerFormIssues(form, converting);
  const set = (k: keyof PartnerNewForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const issue = (k: keyof PartnerNewForm) => (touched && issues.includes(k) ? t(`adminPartnerNew.invalid.${k}`) : undefined);

  const submit = useMutation({
    mutationFn: () =>
      api<AdminPartnerCreated>("/admin/partners", { method: "POST", body: partnerBody(form, converting ? guest?.id ?? null : null) }),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: keys.admin });
    },
  });

  const switchMode = (m: Mode) => {
    setMode(m);
    setGuest(null);
    setForm(EMPTY_PARTNER_FORM);
    setTouched(false);
    submit.reset();
  };
  const pickGuest = (g: GuestSource) => {
    setGuest(g);
    setForm((f) => ({ ...f, ...formFromGuest(g), ...pickShopFields(f) }));
  };
  const startOver = () => {
    setResult(null);
    switchMode("new");
  };

  if (result) {
    return (
      <AdminOpsScreen title={t("adminPartnerNew.title")} query={DONE_QUERY}>
        <Card style={{ gap: space.md }}>
          <AppText variant="heading" accessibilityRole="header">
            {converting ? t("adminPartnerNew.convertedTitle") : t("adminPartnerNew.createdTitle")}
          </AppText>
          <AppText variant="caption">{t("adminPartnerNew.inactiveNote")}</AppText>
          {result.resetUrl ? (
            <>
              <AppText variant="caption">{t("adminPartnerNew.resetBody")}</AppText>
              <Button
                variant="secondary"
                title={t("adminPartnerNew.shareLink")}
                onPress={() =>
                  void Share.share({
                    message: t("adminPartnerNew.shareMessage", { name: form.ownerName, url: result.resetUrl }),
                  }).catch(() => undefined)
                }
              />
            </>
          ) : (
            <AppText variant="caption">{t("adminPartnerNew.hasPassword")}</AppText>
          )}
          <Button title={t("adminPartnerNew.openShop")} onPress={() => router.replace(`/admin/shop/${result.shopId}`)} />
          <Button variant="ghost" title={t("adminPartnerNew.another")} onPress={startOver} />
        </Card>
      </AdminOpsScreen>
    );
  }

  return (
    <AdminOpsScreen title={t("adminPartnerNew.title")} query={DONE_QUERY}>
      <Segmented
        options={[
          { value: "new", label: t("adminPartnerNew.modeNew") },
          { value: "guest", label: t("adminPartnerNew.modeGuest") },
        ]}
        value={mode}
        onChange={switchMode}
      />
      <AppText variant="caption" style={{ fontSize: 13 }}>
        {converting ? t("adminPartnerNew.introGuest") : t("adminPartnerNew.introNew")}
      </AppText>

      {converting && !guest ? (
        <GuestPicker onPick={pickGuest} />
      ) : (
        <Card style={{ gap: space.md }}>
          {converting && guest ? (
            <View style={opsStyles.rowTop}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium">{guest.name || guest.email || guest.id}</AppText>
                {guest.email ? <AppText variant="caption">{guest.email}</AppText> : null}
              </View>
              <Button variant="ghost" title={t("adminPartnerNew.changeGuest")} onPress={() => setGuest(null)} />
            </View>
          ) : (
            <>
              <Field label={t("adminPartnerNew.ownerName")} value={form.ownerName} onChangeText={set("ownerName")} hint={issue("ownerName")} />
              <Field
                label={t("adminPartnerNew.email")}
                value={form.email}
                onChangeText={set("email")}
                keyboardType="email-address"
                autoCapitalize="none"
                hint={issue("email") ?? t("adminPartnerNew.emailHint")}
              />
            </>
          )}
          <Field
            label={t("adminPartnerNew.phone")}
            value={form.phone}
            onChangeText={set("phone")}
            keyboardType="phone-pad"
            placeholder="05xx xxx xx xx"
            hint={issue("phone") ?? t("adminPartnerNew.phoneHint")}
          />
          <SectionTitle>{t("adminPartnerNew.shopSection")}</SectionTitle>
          <Field label={t("adminPartnerNew.shopName")} value={form.shopName} onChangeText={set("shopName")} hint={issue("shopName")} />
          <Field
            label={t("adminPartnerNew.shopAddress")}
            value={form.shopAddress}
            onChangeText={set("shopAddress")}
            multiline
            hint={issue("shopAddress")}
          />
          <View style={styles.row}>
            <Field label={t("adminPartnerNew.city")} value={form.city} onChangeText={set("city")} style={{ flex: 1 }} />
            <Field label={t("adminPartnerNew.district")} value={form.district} onChangeText={set("district")} style={{ flex: 1 }} />
          </View>
          <Field
            label={t("adminPartnerNew.location")}
            value={form.location}
            onChangeText={set("location")}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="41.0151, 28.9795"
            hint={issue("location") ?? t("adminPartnerNew.locationHint")}
          />
          {submit.error ? <Banner tone="danger" body={errorMessage(submit.error, "adminPartnerNew")} /> : null}
          <Button
            title={converting ? t("adminPartnerNew.submitConvert") : t("adminPartnerNew.submitNew")}
            loading={submit.isPending}
            disabled={!canMutateAdminOps() || submit.isPending}
            onPress={() => {
              setTouched(true);
              if (issues.length === 0) submit.mutate();
            }}
          />
        </Card>
      )}
    </AdminOpsScreen>
  );
}

/** Formda dukkan alanlari misafir secilince korunur; yalniz kimlik alanlari degisir. */
function pickShopFields(f: PartnerNewForm): Partial<PartnerNewForm> {
  return { shopName: f.shopName, shopAddress: f.shopAddress, city: f.city, district: f.district, location: f.location };
}

/** Ekranda yuklenecek sorgu yok; iskelet hep icerigi cizsin. */
const DONE_QUERY = { isLoading: false, isRefetching: false, refetch: () => undefined, data: true, error: null, isError: false };

function GuestPicker({ onPick }: { onPick: (g: GuestSource) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const onSearch = useCallback((v: string) => setQ(v), []);
  const query = useAdminUsers(q);
  const guests = flattenPages(query.data, (p) => p.users).filter((u) => u.role === "GUEST");
  return (
    <View style={{ gap: space.sm }}>
      <SearchBox placeholder={t("adminPartnerNew.guestSearch")} onSearch={onSearch} />
      {!q.trim() ? (
        <AppText variant="caption">{t("adminPartnerNew.guestSearchHint")}</AppText>
      ) : query.isLoading ? null : guests.length === 0 ? (
        <AppText variant="caption">{t("adminPartnerNew.guestNone")}</AppText>
      ) : (
        guests.map((u) => (
          <Pressable
            key={u.id}
            accessibilityRole="button"
            onPress={() => onPick({ id: u.id, name: u.name, email: u.email, phone: u.phone })}
            style={({ pressed }) => [opsStyles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
          >
            <AppText variant="bodyMedium" numberOfLines={1}>
              {u.name || u.email}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {[u.email, u.phone].filter(Boolean).join(" · ")}
            </AppText>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
});
