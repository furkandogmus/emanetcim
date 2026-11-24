import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Handshake, TicketPercent, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card, CenterMessage, Divider, Loading } from "@/components/ui";
import { Input } from "@/components/Field";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import { clearPendingReferral, loadPendingReferral, normalizeReferralCode } from "@/lib/pending-referral";
import { formatMoney, formatStayWindow } from "@/lib/format";
import { keys, useOnlinePayments, useShop } from "@/lib/queries";
import { totalBags, useSearch } from "@/lib/search";
import { openSitePage } from "@/lib/site-page";
import type { CheckoutQuote, CheckoutRequest, CheckoutResponse } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function CheckoutScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const { t, i18n } = useTranslation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const onlinePayments = useOnlinePayments();
  const shopQuery = useShop(shopId);
  const { state: authState } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [quotedFor, setQuotedFor] = useState<string | null>(null);
  /*
    Araci "Referans kodu": `?aff=` derin baglantisindan dolar ya da elle girilir.
    Gecerliligi, indirimi ve atfi sunucu belirler (`checkout/quote`).
  */
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [affOpen, setAffOpen] = useState(false);
  const [affInput, setAffInput] = useState("");
  // Misafirin uyguladigi indirim kodu: referans kodu degisince onunla YENIDEN sorulur, dusurulmez.
  const [activeCode, setActiveCode] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPendingReferral().then((code) => {
      if (alive && code) setAffiliateCode((cur) => cur ?? code);
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
    Saatler dukkanin saatine oturtulur (sunucu, `snapStayToShopHours`): alis
    kapanistan sonraysa kapanisa cekilir. Ekran acilir acilmaz sorulur ki misafir
    onaylamadan once GERCEK saati gorsun; rezervasyon da ayni kuralla olusur.
  */
  const hoursQuote = useQuery({
    enabled: !!shopId && authState.status === "signedIn",
    queryKey: ["checkout", "hours", shopId, search.checkIn.toISOString(), search.checkOut.toISOString(), search.bags, affiliateCode],
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
          ...(affiliateCode ? { affiliateCode } : {}),
        },
      }),
    retry: false,
  });
  const notice = hoursQuote.data?.hoursNotice ?? null;
  const closedAtTime = hoursQuote.error instanceof ApiError && hoursQuote.error.code === "shop_closed_at_time";
  const shownIn = hoursQuote.data?.checkInTime ? new Date(hoursQuote.data.checkInTime) : search.checkIn;
  const shownOut = hoursQuote.data?.checkOutTime ? new Date(hoursQuote.data.checkOutTime) : search.checkOut;

  /*
    Onay denemesi anahtari: ayni sepet icin tekrar basmak AYNI anahtari yollar.
    Istek 12 sn'de iptal olsa bile sunucu ilk istegi yazmis olabilir; anahtar
    sayesinde ikinci basis ikinci rezervasyon degil, ayni rezervasyonu doner.
    Sepet ya da tutar degisince (imza) yeni anahtar uretilir.
  */
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  const mutation = useMutation({
    mutationFn: ({ key, ...body }: CheckoutRequest & { key: string }) =>
      api<CheckoutResponse>("/checkout/intent", { method: "POST", body, headers: { "Idempotency-Key": key } }),
    onSuccess: (res) => {
      attempt.current = null;
      clearPendingReferral();
      void queryClient.invalidateQueries({ queryKey: keys.myBookings });
      router.replace({ pathname: "/success", params: { bookingId: res.bookingId } });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 0) {
        // Yanit gelmedi: rezervasyon yazilmis olabilir. Liste yenilenir, tekrar basis guvenli.
        void queryClient.invalidateQueries({ queryKey: keys.myBookings });
        setError(t("checkout.errors.network_maybe"));
        return;
      }
      if (e instanceof ApiError && e.code === "price_changed") {
        // Gosterilen tutar eskidi (indirim dustu / fiyat degisti): kod kalkar, tutar yeniden sorulur.
        attempt.current = null;
        setQuote(null);
        void hoursQuote.refetch();
      }
      setError(errorMessage(e, "checkout"));
    },
  });

  const quoteMutation = useMutation({
    mutationFn: (body: Omit<CheckoutRequest, "couponCode" | "referralCode"> & { code: string; affiliateCode?: string }) =>
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

  // Derin baglantiyla girissiz gelinirse: rezervasyon hesap ister.
  if (authState.status === "signedOut") return <Redirect href="/login" />;

  if (shopQuery.isLoading) return <Loading />;
  if (!shopQuery.data) {
    return (
      <CenterMessage
        title={errorMessage(shopQuery.error)}
        action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
      />
    );
  }

  const shop = shopQuery.data;
  const bagCount = totalBags(search.bags);
  const booking = {
    shopId: shop.id,
    checkInTime: shownIn.toISOString(),
    checkOutTime: shownOut.toISOString(),
    bagCountS: search.bags.s,
    bagCountM: search.bags.m,
    bagCountXl: search.bags.xl,
  };
  // Onizleme baska bir sepet ya da referans kodu icin alinmissa gecersizdir.
  const quoteKey = JSON.stringify([booking, affiliateCode]);
  const applied = quote && quotedFor === quoteKey ? quote : null;
  /*
    Fiyat YALNIZCA sunucudan (checkout/quote). Ekran eskiden kendi formuluyle
    "tahmini toplam" gosteriyordu: carpanlar, sigorta ve saat oturtmasi iki yerde
    yasiyordu ve ayrisinca misafir bir tutar gorup baska bir tutar oduyordu.
  */
  const priced = applied ?? hoursQuote.data ?? null;
  const total = priced?.total ?? null;
  const affiliate = priced?.affiliate ?? null;
  // Sunucu kodu kabul ettiyse (indirimli ya da yalnizca atif) rezervasyona gider.
  const affiliateAccepted = !!affiliateCode && (affiliate?.status === "applied" || affiliate?.status === "attributed");
  const shownDiscount = priced?.discount ?? null;

  function quoteCode(code: string, aff: string | null) {
    setCodeError(null);
    setQuotedFor(JSON.stringify([booking, aff]));
    quoteMutation.mutate({ ...booking, code, ...(aff ? { affiliateCode: aff } : {}) });
  }

  function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    setActiveCode(code);
    quoteCode(code, affiliateCode);
  }

  function changeAffiliate(next: string | null) {
    setAffiliateCode(next);
    if (activeCode) quoteCode(activeCode, next);
  }

  function applyAffiliate() {
    const code = normalizeReferralCode(affInput);
    if (!code) return;
    changeAffiliate(code);
    setAffOpen(false);
  }

  function removeAffiliate() {
    changeAffiliate(null);
    setAffInput("");
    clearPendingReferral();
  }

  function removeCode() {
    setQuote(null);
    setActiveCode(null);
    setCodeInput("");
    setCodeError(null);
  }

  function confirm() {
    setError(null);
    const request: CheckoutRequest = {
      ...booking,
      ...(applied?.discount?.kind === "coupon" ? { couponCode: applied.discount.code } : {}),
      ...(applied?.discount?.kind === "referral" ? { referralCode: applied.discount.code } : {}),
      ...(affiliateAccepted && affiliateCode ? { affiliateCode } : {}),
      ...(total != null ? { expectedTotal: total } : {}),
    };
    const sig = JSON.stringify(request);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    mutation.mutate({ ...request, key: attempt.current.key });
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
            value={formatStayWindow(shownIn, shownOut)}
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
          {!priced ? (
            hoursQuote.isError && !closedAtTime ? (
              <View style={{ gap: space.sm }}>
                <AppText variant="body" style={{ color: colors.inkSecondary }}>
                  {errorMessage(hoursQuote.error, "checkout")}
                </AppText>
                <Button variant="secondary" title={t("common.retry")} onPress={() => hoursQuote.refetch()} />
              </View>
            ) : closedAtTime ? (
              // Dukkan o saatte kapali: iskelet sonsuza dek doner, cikis yolu gosterilir.
              <Button
                title={t("checkout.pickOtherTime")}
                onPress={() => router.push({ pathname: "/search", params: { step: "1", returnTo: "back" } })}
              />
            ) : (
              [0, 1].map((i) => <View key={i} style={styles.lineSkeleton} />)
            )
          ) : null}
          {(priced?.lines ?? []).map((l) => (
            <View key={l.size} style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1 }}>
                {t("checkout.bagLine", {
                  count: l.count,
                  size: t(`bags.${l.size}`),
                  days: t("common.day", { count: l.days }),
                })}
              </AppText>
              <AppText variant="body">{formatMoney(l.amount)}</AppText>
            </View>
          ))}
          {priced?.insuranceFee ? (
            <View style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1 }}>
                {t("checkout.insurance")}
              </AppText>
              <AppText variant="body">{formatMoney(priced.insuranceFee)}</AppText>
            </View>
          ) : null}
          {shownDiscount ? (
            <View style={styles.priceRow}>
              <AppText variant="body" style={{ flex: 1, color: colors.success }}>
                {t(
                  shownDiscount.kind === "coupon"
                    ? "checkout.code.couponLine"
                    : shownDiscount.kind === "affiliate"
                      ? "checkout.affiliate.line"
                      : "checkout.code.referralLine",
                  { code: shownDiscount.code },
                )}
              </AppText>
              <AppText variant="body" style={{ color: colors.success }}>
                −{formatMoney(shownDiscount.amount)}
              </AppText>
            </View>
          ) : null}
          <Divider />
          <View style={styles.priceRow}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {t("checkout.total")}
            </AppText>
            <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
              {total != null ? formatMoney(total) : "–"}
            </AppText>
          </View>
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

        <Card style={{ gap: space.md }}>
          {affiliateCode ? (
            <View style={styles.editRow}>
              <Handshake size={18} strokeWidth={1.75} color={affiliateAccepted ? colors.success : colors.inkSecondary} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium">{affiliateCode}</AppText>
                <AppText variant="caption" style={!affiliateAccepted && !hoursQuote.isFetching ? { color: colors.danger } : undefined}>
                  {!affiliate
                    ? hoursQuote.isFetching
                      ? t("checkout.affiliate.checking")
                      : hoursQuote.isError
                        ? // Ag hatasi kodun gecersiz oldugu anlamina gelmez.
                          errorMessage(hoursQuote.error, "checkout")
                        : t("checkout.affiliate.invalid")
                    : affiliate.status === "applied"
                      ? t("checkout.affiliate.applied", { pct: affiliate.ratePct })
                      : affiliate.status === "attributed"
                        ? t("checkout.affiliate.attributed")
                        : t(`checkout.affiliate.${affiliate.status}`)}
                </AppText>
                {!affiliate && hoursQuote.isError && !hoursQuote.isFetching ? (
                  <Pressable accessibilityRole="button" onPress={() => void hoursQuote.refetch()} hitSlop={8}>
                    <AppText variant="caption" style={{ color: colors.accent }}>
                      {t("common.retry")}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("checkout.affiliate.remove")}
                onPress={removeAffiliate}
                hitSlop={10}
              >
                <X size={18} strokeWidth={1.75} color={colors.inkSecondary} />
              </Pressable>
            </View>
          ) : affOpen ? (
            <>
              <AppText variant="label">{t("checkout.affiliate.label")}</AppText>
              <View style={styles.codeRow}>
                <Input
                  value={affInput}
                  onChangeText={setAffInput}
                  accessibilityLabel={t("checkout.affiliate.label")}
                  placeholder={t("checkout.affiliate.placeholder")}
                  placeholderTextColor={colors.inkMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  maxLength={32}
                  returnKeyType="done"
                  onSubmitEditing={applyAffiliate}
                  style={styles.codeInput}
                />
                <Button
                  variant="secondary"
                  title={t("checkout.apply")}
                  disabled={!normalizeReferralCode(affInput)}
                  onPress={applyAffiliate}
                />
              </View>
              <AppText variant="caption">{t("checkout.affiliate.hint")}</AppText>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setAffOpen(true)} style={styles.editRow}>
              <Handshake size={18} strokeWidth={1.75} color={colors.inkSecondary} />
              <AppText variant="bodyMedium" style={{ flex: 1 }}>
                {t("checkout.affiliate.prompt")}
              </AppText>
              <AppText variant="bodyMedium" style={{ color: colors.accent }}>
                {t("checkout.code.add")}
              </AppText>
            </Pressable>
          )}
        </Card>

        {/* Dukkanda tahsilat modunda gecerli; online kipte bu cumle yanlis olur. */}
        {onlinePayments ? null : (
          <View style={styles.payNote}>
            <AppText variant="body" style={{ flex: 1, color: colors.inkSecondary }}>
              {t("checkout.payAtShop")}
            </AppText>
          </View>
        )}

        {/* Iptal kurali onaydan once gorunsun. Kademe yok: valiz birakilana kadar tam iade (`cancelBooking`). */}
        <Pressable
          accessibilityRole="link"
          onPress={() => openSitePage("cancellation", i18n.language)}
          style={styles.payNote}
        >
          <AppText variant="body" style={{ flex: 1, color: colors.inkSecondary }}>
            {t("accountParity.checkoutCancellation")}{" "}
            <AppText variant="body" style={{ color: colors.accent }}>
              {t("accountParity.checkoutCancellationLink")}
            </AppText>
          </AppText>
        </Pressable>

      </ScrollView>
      </KeyboardAvoidingView>

      {/* Onay aninda tutar gozden kaybolmasin: dukkan ekranindaki alt cubukla ayni duzen. */}
      <View style={styles.footer}>
        {/* Hata onay dugmesinin hemen ustunde: ScrollView'in sonunda kucuk ekranda gorunmuyordu. */}
        {error ? <Banner tone="danger" body={error} /> : null}
        <View style={styles.footerRow}>
        <View>
          <AppText variant="caption">{t("checkout.total")}</AppText>
          <AppText style={styles.footerTotal}>{total != null ? formatMoney(total) : "–"}</AppText>
        </View>
        <Button
          title={t("checkout.confirm")}
          loading={mutation.isPending}
          disabled={bagCount === 0 || closedAtTime || total == null}
          onPress={confirm}
          style={{ flex: 1 }}
        />
        </View>
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
  lineSkeleton: { height: 20, borderRadius: radius.inner, backgroundColor: colors.surfaceMuted },
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
    gap: space.md,
    padding: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  footerTotal: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, fontVariant: ["tabular-nums"] },
});
