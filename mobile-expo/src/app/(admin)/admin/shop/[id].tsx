import { useState } from "react";
import type { ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight, ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/Field";
import { StackHeader } from "@/components/StackHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay, formatDayTime } from "@/lib/format";
import { SITE_ORIGIN } from "@/lib/images";
import { telUrl, waUrl } from "@/lib/phone";
import { useViewAs } from "@/lib/use-view-as";
import { notify } from "@/lib/notify";
import { keys, useAdminShop } from "@/lib/queries";
import type { AdminShopDetail, AdminShopPatch } from "@/lib/types";
import { colors, radius, space } from "@/theme/tokens";

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** "cappadocia" -> "Cappadocia": sehir sayfasi slug'i mobilde cevrilmiyor, okunur olsun yeter. */
const cityLabel = (slug: string) => slug.charAt(0).toLocaleUpperCase("tr") + slug.slice(1);

/**
 * Admin dukkan karti: misafire gorunurluk, bayraklar (aktif, dogrulanmis, test), fiyat ve
 * kapasite, sahibine ulasma ve son rezervasyonlar. Kural sunucuda (`ShopService.adminUpdateShop`).
 */
export default function AdminShopScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useAdminShop(id);
  const lang = i18n.language === "tr" ? "tr" : "en";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StackHeader
        right={
          query.data ? (
            <IconButton
              label={t("admin.openOnWeb")}
              onPress={() => open(`${SITE_ORIGIN}/${lang}/admin/partners/${query.data?.id ?? ""}/edit`)}
            >
              <ExternalLink size={18} color={colors.ink} />
            </IconButton>
          ) : undefined
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : query.isError || !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "admin")}
          action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
        />
      ) : (
        <Detail shop={query.data} />
      )}
    </SafeAreaView>
  );
}

function Detail({ shop: s }: { shop: AdminShopDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const viewAs = useViewAs();
  const [price, setPrice] = useState(String(s.pricePerDay));
  const [capacity, setCapacity] = useState(String(s.capacity));
  const [lat, setLat] = useState(s.latitude == null ? "" : String(s.latitude));
  const [lng, setLng] = useState(s.longitude == null ? "" : String(s.longitude));
  const [locSaved, setLocSaved] = useState(false);
  // Basari penceresi yerine dugme "Kaydedildi" der: Android'de bos govdeli Alert kocaman kaliyordu.
  const [saved, setSaved] = useState(false);

  const update = useMutation({
    mutationFn: (patch: AdminShopPatch) =>
      api<AdminShopDetail>(`/admin/shops/${encodeURIComponent(s.id)}`, { method: "PATCH", body: patch }),
    onSuccess: (next, patch) => {
      queryClient.setQueryData([...keys.admin, "shop", s.id], next);
      for (const k of ["shops", "overview"]) void queryClient.invalidateQueries({ queryKey: [...keys.admin, k] });
      if (patch.pricePerDay !== undefined) setSaved(true);
      if (patch.latitude !== undefined) setLocSaved(true);
    },
    onError: (e) => notify(t("admin.actionFailed"), errorMessage(e, "admin")),
  });

  const priceNum = Number(price.replace(",", "."));
  const capNum = Number(capacity);
  const priceValid = Number.isFinite(priceNum) && priceNum >= 1;
  const capValid = Number.isInteger(capNum) && capNum >= 1;
  const dirty = priceNum !== s.pricePerDay || capNum !== s.capacity;
  const latNum = Number(lat.trim().replace(",", "."));
  const lngNum = Number(lng.trim().replace(",", "."));
  const latValid = lat.trim() !== "" && Number.isFinite(latNum) && Math.abs(latNum) <= 90;
  const lngValid = lng.trim() !== "" && Number.isFinite(lngNum) && Math.abs(lngNum) <= 180;
  const locDirty = latNum !== s.latitude || lngNum !== s.longitude;

  // Misafirden saklayan iki degisiklik onay ister; geri almak mumkun ama o arada arama bos kalir.
  function toggle(field: "isActive" | "isTest" | "isVerified", value: boolean) {
    const hides = (field === "isActive" && !value) || (field === "isTest" && value);
    if (!hides) return update.mutate({ [field]: value });
    Alert.alert(t(`admin.confirm.${field}.title`, { name: s.name }), t(`admin.confirm.${field}.body`), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t(`admin.confirm.${field}.cta`), style: "destructive", onPress: () => update.mutate({ [field]: value }) },
    ]);
  }

  const directions =
    s.latitude != null && s.longitude != null
      ? Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${s.latitude},${s.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`
      : null;
  const wa = s.owner.whatsapp ?? null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <AppText variant="title">{s.name}</AppText>
          {s.isVerified ? (
            <View style={styles.titleLine}>
              <BadgeCheck size={14} color={colors.accent} />
              <AppText variant="caption" style={{ color: colors.accent }}>
                {t("admin.verified")}
              </AppText>
            </View>
          ) : null}
          {/* Adres cogu zaman semt ve ili zaten iceriyor; ikisini birden yazmak tekrar ediyordu. */}
          {s.address || s.place ? <AppText variant="caption">{s.address || s.place}</AppText> : null}
          <AppText variant="caption">{t("admin.shopSince", { date: formatDay(s.createdAt) })}</AppText>
        </View>

        {s.isPrelaunch ? <Banner tone="brand" body={t("admin.prelaunchNote")} /> : null}
        {s.issues.length > 0 ? (
          <Banner
            tone="warning"
            title={t("admin.visibilityIssues")}
            body={s.issues.map((i) => `• ${t(`admin.shopIssue.${i}`)}`).join("\n")}
          />
        ) : null}

        <Block title={t("admin.visibility")}>
          <Card style={{ gap: 0, paddingVertical: space.sm }}>
            <ToggleRow
              label={t("admin.flag.isActive")}
              hint={t("admin.flagHint.isActive")}
              value={s.isActive}
              disabled={update.isPending}
              onChange={(v) => toggle("isActive", v)}
            />
            <ToggleRow
              label={t("admin.flag.isVerified")}
              hint={t("admin.flagHint.isVerified")}
              value={s.isVerified}
              disabled={update.isPending}
              onChange={(v) => toggle("isVerified", v)}
            />
            <ToggleRow
              label={t("admin.flag.isTest")}
              hint={t("admin.flagHint.isTest")}
              value={s.isTest}
              disabled={update.isPending}
              onChange={(v) => toggle("isTest", v)}
              last
            />
          </Card>
          {s.cityPages.length > 0 && !s.isTest ? (
            <AppText variant="caption">
              {t("admin.listedOn", { cities: s.cityPages.map(cityLabel).join(", ") })}
            </AppText>
          ) : null}
        </Block>

        {!s.isPrelaunch ? (
          <Block title={t("admin.today")}>
            <View style={styles.facts}>
              <Fact label={t("admin.occupancy")} value={t("admin.bagsOfCapacity", { bags: s.bagsInStorage, capacity: s.capacity })} />
              <Fact label={t("admin.arrivals")} value={String(s.arrivalsToday)} />
              <Fact label={t("admin.pickups")} value={String(s.pickupsToday)} />
            </View>
          </Block>
        ) : null}

        <Block title={t("admin.pricing")}>
          <Card style={{ gap: space.lg }}>
            <View style={styles.fieldRow}>
              <Field
                style={{ flex: 1 }}
                label={t("admin.factPrice")}
                value={price}
                onChangeText={(v) => {
                  setPrice(v);
                  setSaved(false);
                }}
                keyboardType="decimal-pad"
                hint={priceValid ? undefined : t("admin.invalidNumber")}
              />
              <Field
                style={{ flex: 1 }}
                label={t("admin.factCapacity")}
                value={capacity}
                onChangeText={(v) => {
                  setCapacity(v);
                  setSaved(false);
                }}
                keyboardType="number-pad"
                hint={capValid ? undefined : t("admin.invalidNumber")}
              />
            </View>
            <Button
              title={saved && !dirty ? t("admin.shopSaved") : t("admin.save")}
              disabled={!dirty || !priceValid || !capValid}
              loading={update.isPending && update.variables?.pricePerDay !== undefined}
              onPress={() => update.mutate({ pricePerDay: priceNum, capacity: capNum })}
            />
          </Card>
          {s.hours ? (
            <AppText variant="caption">{t("admin.hoursLine", { open: s.hours.open, close: s.hours.close })}</AppText>
          ) : (
            <AppText variant="caption">{t("admin.open247")}</AppText>
          )}
        </Block>

        <Block title={t("admin.location")}>
          <Card style={{ gap: space.lg }}>
            <View style={styles.fieldRow}>
              <Field
                style={{ flex: 1 }}
                label={t("admin.latitude")}
                value={lat}
                onChangeText={(v) => {
                  setLat(v);
                  setLocSaved(false);
                }}
                keyboardType="numbers-and-punctuation"
                hint={lat.trim() === "" || latValid ? undefined : t("admin.invalidNumber")}
              />
              <Field
                style={{ flex: 1 }}
                label={t("admin.longitude")}
                value={lng}
                onChangeText={(v) => {
                  setLng(v);
                  setLocSaved(false);
                }}
                keyboardType="numbers-and-punctuation"
                hint={lng.trim() === "" || lngValid ? undefined : t("admin.invalidNumber")}
              />
            </View>
            <AppText variant="caption">{t("admin.locationHint")}</AppText>
            <Button
              title={locSaved && !locDirty ? t("admin.shopSaved") : t("admin.save")}
              disabled={!locDirty || !latValid || !lngValid}
              loading={update.isPending && update.variables?.latitude !== undefined}
              onPress={() => update.mutate({ latitude: latNum, longitude: lngNum })}
            />
          </Card>
        </Block>

        <Block title={t("admin.owner")}>
          <Card style={{ gap: space.md }}>
            <View style={{ gap: 2 }}>
              <AppText variant="bodyMedium">{s.owner.name || "—"}</AppText>
              {s.owner.email ? <AppText variant="caption">{s.owner.email}</AppText> : null}
              {s.owner.phone ? <AppText variant="caption">{s.owner.phone}</AppText> : null}
            </View>
            <View style={styles.actions}>
              {s.owner.phone ? (
                <Button variant="secondary" title={t("admin.call")} icon={<Phone size={16} color={colors.ink} />} onPress={() => open(telUrl(s.owner.phone, s.owner.whatsapp))} style={{ flex: 1 }} />
              ) : null}
              {wa ? (
                <IconButton label="WhatsApp" onPress={() => open(waUrl(wa))}>
                  <MessageCircle size={18} color={colors.ink} />
                </IconButton>
              ) : null}
              {s.owner.email ? (
                <IconButton label={t("admin.email")} onPress={() => open(`mailto:${s.owner.email}`)}>
                  <Mail size={18} color={colors.ink} />
                </IconButton>
              ) : null}
              {directions ? (
                <IconButton label={t("admin.showOnMap")} onPress={() => open(directions)}>
                  <MapPin size={18} color={colors.ink} />
                </IconButton>
              ) : null}
            </View>
            <Button
              variant="secondary"
              title={t("admin.impersonateOwner")}
              loading={viewAs.pendingId === s.owner.id}
              disabled={viewAs.pendingId !== undefined}
              onPress={() => viewAs.confirmViewAs(s.owner.id, s.owner.name || s.name)}
            />
          </Card>
        </Block>

        <Block title={t("admin.recentBookings", { count: s.bookingCount })}>
          {s.recent.length === 0 ? (
            <AppText variant="caption">{t("admin.noBookingsYet")}</AppText>
          ) : (
            <View style={styles.listCard}>
              {s.recent.map((b, i) => (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/admin/booking/${b.id}`)}
                  style={({ pressed }) => [styles.bookingRow, i > 0 && styles.divider, pressed && { backgroundColor: colors.surfaceMuted }]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyMedium" numberOfLines={1}>
                      {b.guestName || t("partner.guest")}
                    </AppText>
                    <AppText variant="caption" style={{ fontSize: 13 }}>
                      {formatDayTime(b.checkInTime)}
                    </AppText>
                  </View>
                  <StatusBadge status={b.status} />
                  <ChevronRight size={16} color={colors.inkMuted} />
                </Pressable>
              ))}
            </View>
          )}
        </Block>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  disabled,
  onChange,
  last,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggle, !last && styles.toggleDivider]}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyMedium">{label}</AppText>
        <AppText variant="caption" style={{ fontSize: 13 }}>
          {hint}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.borderStrong }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{title}</AppText>
      {children}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" style={{ fontSize: 12 }}>
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: space.xxl, gap: space.xl },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  toggleDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  facts: { flexDirection: "row", gap: space.sm },
  fact: {
    flex: 1,
    gap: 2,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldRow: { flexDirection: "row", gap: space.md },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  listCard: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
