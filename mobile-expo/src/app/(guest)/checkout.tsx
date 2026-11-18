import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { TicketPercent, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card, CenterMessage, Divider, Loading } from "@/components/ui";
import { Input } from "@/components/Field";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, formatMoney, stayDays } from "@/lib/format";
import { estimate } from "@/lib/pricing";
import { keys, useShop } from "@/lib/queries";
import { totalBags, useSearch } from "@/lib/search";
import type { CheckoutQuote, CheckoutRequest, CheckoutResponse } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function CheckoutScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { t } = useTranslation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const shopQuery = useShop(shopId);
  const [error, setError] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [quotedFor, setQuotedFor] = useState<string | null>(null);

  /*
    Saatler dukkanin saatine oturtulur (sunucu, `snapStayToShopHours`): alis
    kapanistan sonraysa kapanisa cekilir. Ekran acilir acilmaz sorulur ki misafir
    onaylamadan once GERCEK saati gorsun; rezervasyon da ayni kuralla olusur.
  */
  const hoursQuote = useQuery({
    enabled: !!shopId,
    queryKey: ["checkout", "hours", shopId, search.checkIn.toISOString(), search.checkOut.toISOString(), search.bags],
    queryFn: () =>
      api<CheckoutQuote>("/checkout/quote", {
        method: "POST",
        body: {
          shopId,
          checkInTime: search.checkIn.toISOString(),
          checkOutTime: search.checkOut.toISOString(),
          bagCountS: search.bags.s,
          bagCountM: search.bags.m,
          bagCountXl: search.bags.xl,
        },
      }),
    retry: false,
  });
  const notice = hoursQuote.data?.hoursNotice ?? null;
  const closedAtTime = hoursQuote.error instanceof ApiError && hoursQuote.error.code === "shop_closed_at_time";
  const shownIn = hoursQuote.data?.checkInTime ? new Date(hoursQuote.data.checkInTime) : search.checkIn;
  const shownOut = hoursQuote.data?.checkOutTime ? new Date(hoursQuote.data.checkOutTime) : search.checkOut;

  const mutation = useMutation({
    mutationFn: (body: CheckoutRequest) =>
      api<CheckoutResponse>("/checkout/intent", { method: "POST", body }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: keys.myBookings });
      router.replace({ pathname: "/success", params: { bookingId: res.bookingId } });
    },
    onError: (e) => setError(errorMessage(e, "checkout")),
  });

  const quoteMutation = useMutation({
    mutationFn: (body: Omit<CheckoutRequest, "couponCode" | "referralCode"> & { code: string }) =>
      api<CheckoutQuote>("/checkout/quote", { method: "POST", body }),
    onSuccess: (res) => {
      if (res.codeStatus === "applied") {
        setQuote(res);
        setCodeError(null);
        return;
      }
      setQuote(null);
      setCodeError(
        res.codeStatus === "min_price" && res.minPrice != null
          ? t("checkout.code.min_price", { amount: formatMoney(res.minPrice) })
          : t(`checkout.code.${res.codeStatus ?? "invalid"}`),
      );
    },
    onError: (e) => setCodeError(errorMessage(e, "checkout")),
  });

  if (shopQuery.isLoading) return <Loading />;
  if (shopQuery.isError || !shopQuery.data) {
    return (
      <CenterMessage
        title={errorMessage(shopQuery.error)}
        action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
      />
    );
  }

  const shop = shopQuery.data;
  // Gun sayisi dukkanin saatine oturtulmus anlardan: sunucu da onlarla fiyatlar.
  const days = stayDays(shownIn, shownOut);
  const price = estimate(shop, search.bags, days);
  const bagCount = totalBags(search.bags);
  const booking = {
    shopId: shop.id,
    checkInTime: shownIn.toISOString(),
    checkOutTime: shownOut.toISOString(),
    bagCountS: search.bags.s,
    bagCountM: search.bags.m,
    bagCountXl: search.bags.xl,
  };
  // Onizleme baska bir sepet icin alinmissa (tarih/valiz degisti) gecersizdir.
  const quoteKey = JSON.stringify(booking);
  const applied = quote && quotedFor === quoteKey ? quote : null;
  // Kesin tutar sunucudan; tahmin yalnizca onizleme gelene kadar.
  const total = applied ? applied.total : (hoursQuote.data?.total ?? price.total);

  function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    setCodeError(null);
    setQuotedFor(quoteKey);
    quoteMutation.mutate({ ...booking, code });
  }

  function removeCode() {
    setQuote(null);
    setCodeInput("");
    setCodeError(null);
  }

  function confirm() {
    setError(null);
    mutation.mutate({
      ...booking,
      ...(applied?.discount?.kind === "coupon" ? { couponCode: applied.discount.code } : {}),
      ...(applied?.discount?.kind === "referral" ? { referralCode: applied.discount.code } : {}),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StackHeader title={t("checkout.title")} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: space.md }}>
          <AppText variant="heading">{shop.name}</AppText>
          <Divider />
          <EditableRow
            label={t("checkout.when")}
            value={`${formatDayTime(shownIn)}\n→ ${formatDayTime(shownOut)}`}
            onEdit={() => router.push({ pathname: "/search", params: { step: "1", returnTo: "back" } })}
          />
          {closedAtTime ? <Banner tone="danger" body={t("checkout.errors.shop_closed_at_time")} /> : null}
          {notice ? (
            <Banner
              tone="warning"
              title={t("checkout.hours.title")}
              body={[
                notice.drop ? t("checkout.hours.dropOpens", { time: notice.drop.at }) : null,
                notice.pickup
                  ? t(notice.pickup.reason === "closes" ? "checkout.hours.pickupCloses" : "checkout.hours.pickupOpens", {
                      time: notice.pickup.at,
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" ")}
            />
          ) : null}
          <EditableRow
            label={t("checkout.bags")}
            value={t("common.bag", { count: bagCount })}
            onEdit={() => router.push({ pathname: "/search", params: { step: "2", returnTo: "back" } })}
          />
        </Card>

        <Card style={{ gap: space.sm }}>
          <AppText variant="heading">{t("checkout.priceTitle")}</AppText>
          {price.lines.map((l) => (
            <View key={l.size} style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1 }}>
                {t("checkout.bagLine", {
                  count: l.count,
                  size: t(`bags.${l.size}`),
                  days: t("common.day", { count: days }),
                })}
              </AppText>
              <AppText variant="body">{formatMoney(l.count * l.unit * days)}</AppText>
            </View>
          ))}
          {price.insurance > 0 ? (
            <View style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1 }}>
                {t("checkout.insurance")}
              </AppText>
              <AppText variant="body">{formatMoney(price.insurance)}</AppText>
            </View>
          ) : null}
          {applied?.discount ? (
            <View style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1, color: colors.success }}>
                {t(applied.discount.kind === "coupon" ? "checkout.code.couponLine" : "checkout.code.referralLine", {
                  code: applied.discount.code,
                })}
              </AppText>
              <AppText variant="body" style={{ color: colors.success }}>
                −{formatMoney(applied.discount.amount)}
              </AppText>
            </View>
          ) : null}
          <Divider />
          <View style={styles.priceRow}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {t("checkout.estimatedTotal")}
            </AppText>
            <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
              {formatMoney(total)}
            </AppText>
          </View>
          <AppText variant="caption">{t("checkout.estimateNote")}</AppText>
        </Card>

        <Card style={{ gap: space.md }}>
          {applied?.discount ? (
            <View style={styles.editRow}>
              <TicketPercent size={18} strokeWidth={1.75} color={colors.success} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium">{applied.discount.code}</AppText>
                <AppText variant="caption">
                  {t("checkout.code.saved", { amount: formatMoney(applied.discount.amount) })}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("checkout.code.remove")}
                onPress={removeCode}
                hitSlop={10}
              >
                <X size={18} strokeWidth={1.75} color={colors.inkSecondary} />
              </Pressable>
            </View>
          ) : codeOpen ? (
            <>
              <AppText variant="label">{t("checkout.code.label")}</AppText>
              <View style={styles.codeRow}>
                <Input
                  value={codeInput}
                  onChangeText={(v) => {
                    setCodeInput(v);
                    setCodeError(null);
                  }}
                  accessibilityLabel={t("checkout.code.label")}
                  placeholder={t("checkout.code.placeholder")}
                  placeholderTextColor={colors.inkMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  maxLength={64}
                  returnKeyType="done"
                  onSubmitEditing={applyCode}
                  style={styles.codeInput}
                />
                <Button
                  variant="secondary"
                  title={t("checkout.apply")}
                  loading={quoteMutation.isPending}
                  disabled={!codeInput.trim()}
                  onPress={applyCode}
                />
              </View>
              {codeError ? (
                <AppText variant="caption" style={{ color: colors.danger }}>
                  {codeError}
                </AppText>
              ) : (
                <AppText variant="caption">{t("checkout.code.hint")}</AppText>
              )}
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setCodeOpen(true)} style={styles.editRow}>
              <TicketPercent size={18} strokeWidth={1.75} color={colors.inkSecondary} />
              <AppText variant="bodyMedium" style={{ flex: 1 }}>
                {t("checkout.code.prompt")}
              </AppText>
              <AppText variant="bodyMedium" style={{ color: colors.accent }}>
                {t("checkout.code.add")}
              </AppText>
            </Pressable>
          )}
        </Card>

        <View style={styles.payNote}>
          <AppText variant="body" style={{ flex: 1, color: colors.inkSecondary }}>
            {t("checkout.payAtShop")}
          </AppText>
        </View>

        {error ? <Banner tone="danger" body={error} /> : null}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Onay aninda tutar gozden kaybolmasin: dukkan ekranindaki alt cubukla ayni duzen. */}
      <View style={styles.footer}>
        <View>
          <AppText variant="caption">{t("checkout.estimatedTotal")}</AppText>
          <AppText style={styles.footerTotal}>{formatMoney(total)}</AppText>
        </View>
        <Button
          title={t("checkout.confirm")}
          loading={mutation.isPending}
          disabled={bagCount === 0 || closedAtTime}
          onPress={confirm}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

function EditableRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.editRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="bodyMedium">{value}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t("checkout.edit")}: ${label}`} onPress={onEdit} hitSlop={10}>
        <AppText variant="bodyMedium" style={{ color: colors.accent }}>
          {t("checkout.edit")}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  content: { padding: space.xl, gap: space.lg },
  editRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  priceRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  codeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  codeInput: { flex: 1, fontFamily: fonts.monoMedium, letterSpacing: 1 },
  payNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerTotal: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, fontVariant: ["tabular-nums"] },
});
