import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagRevisionCard } from "@/components/BagRevisionCard";
import { BookingTicket } from "@/components/BookingTicket";
import { ExpiredBookingActions } from "@/components/ExpiredBookingActions";
import { GuestBagRevisionCard } from "@/components/GuestBagRevisionCard";
import { GuestDisputeCard } from "@/components/GuestDisputeCard";
import { GuestReviewCard } from "@/components/GuestReviewCard";
import { PartnerBookingActions } from "@/components/PartnerBookingActions";
import { AppText, Banner, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney, formatTime } from "@/lib/format";
import { lateDropoffState } from "@/lib/booking-actions";
import { BEFORE_DROP_OFF, isBookingExpired } from "@/lib/booking-state";
import { isActiveBooking, useBooking, useOnlinePayments } from "@/lib/queries";
import { defaultWindow, useSearch } from "@/lib/search";
import type { BookingDetail } from "@/lib/types";
import { notify } from "@/lib/notify";
import { whatsappNumber, dialUrl, openUrl, waUrl } from "@/lib/phone";
import { googleCalendarUrl } from "@/lib/calendar-link";
import { bookingCode } from "@/lib/booking-search";
import { loadOfflineTicket, saveOfflineTicket, type OfflineTicket } from "@/lib/offline-tickets";
import { colors, radius, space } from "@/theme/tokens";
import { StaleQueryBanner } from "@/components/StaleQueryBanner";
import { WalletPassButton } from "@/components/WalletPassButton";

/** Misafirin iptal edebildigi durumlar: valiz henuz dukkana teslim edilmemis. */
const CANCELLABLE = BEFORE_DROP_OFF;
/** `modifyBooking` (lifecycle.ts) yalnizca CHECKED_IN / CHECKED_OUT / CANCELLED'i reddeder. */
const MODIFIABLE = BEFORE_DROP_OFF;

/** Koordinat yoksa adresle: koordinatsiz dukkanda yol tarifi hic yoktu. */
function canNavigate(b: BookingDetail) {
  return (b.latitude != null && b.longitude != null) || !!b.shopAddress;
}

function openDirections(b: BookingDetail) {
  if (!canNavigate(b)) return;
  const q =
    b.latitude != null && b.longitude != null ? `${b.latitude},${b.longitude}` : encodeURIComponent(b.shopAddress!);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${q}`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  void Linking.openURL(url).catch(() => undefined);
}

/** Esnaf, gelmeyen ya da gec kalan misafiri arar / yazar. Numara yoksa hicbir sey cizilmez. */
function GuestContact({ phone }: { phone?: string }) {
  const { t } = useTranslation();
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  // Ulke kodu belli degilse WhatsApp gosterilmez (yanlis kisiye gitmesin); Ara her zaman var.
  const intl = whatsappNumber(phone);
  return (
    <View style={styles.actionRow}>
      <Button
        variant="secondary"
        style={{ flex: 1 }}
        title={t("partner.callGuest")}
        onPress={() => void Linking.openURL(dialUrl(digits)).catch(() => undefined)}
      />
      {intl ? (
        <Button
          variant="secondary"
          style={{ flex: 1 }}
          title={t("partner.whatsappGuest")}
          onPress={() => void Linking.openURL(`https://wa.me/${intl}`).catch(() => undefined)}
        />
      ) : null}
    </View>
  );
}

/** Misafir: birakma saati gectiyse rezervasyonun ne zaman otomatik kapanacagi. */
function GuestLateNotice({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const late = lateDropoffState(booking);
  if (late.kind !== "late") return null;
  return (
    <Banner
      tone="warning"
      body={
        late.holdUntil
          ? t("bookings.lateDropoffHold", { time: formatTime(late.holdUntil) })
          : t("bookings.lateDropoff", { time: formatTime(late.closeAt) })
      }
    />
  );
}

export function BookingDetailView({ id, mode }: { id: string; mode: "guest" | "partner" }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useBooking(id, { saveOffline: mode === "guest" });
  const scrollRef = useRef<ScrollView>(null);
  const search = useSearch();
  const onlinePayments = useOnlinePayments();

  /**
   * Degerlendirme / sorun formu sayfanin en altinda acilir; acildiginda ekranin
   * altinda, gorunmeyen yerde kaliyordu (2026-10-18, emulator). Form cizildikten
   * sonra sona kaydirilir.
   */
  function revealForm() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  const cancel = useMutation({
    mutationFn: () => api<{ success: boolean; fullRefund: boolean }>(`/bookings/${id}/cancel`, { method: "DELETE" }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      // Sunucuda `fullRefund = hadPayment` (lifecycle.ts): false "kismi ucret"
      // DEGIL, "hic odeme alinmamisti" demek -- dukkanda odeme modunda hep boyle.
      // Kartli iade yalnizca online kipte dogru; dukkanda tahsilatta kart iadesi vaat edilmez.
      notify(
        t("bookings.cancelledTitle"),
        !res.fullRefund
          ? t("bookings.cancelledNoCharge")
          : onlinePayments
            ? t("bookings.cancelledRefund")
            : t("bookings.cancelledRefundOnsite"),
      );
    },
    onError: (e) => {
      // Sunucu durumu degismis olabilir (zaten iptal / teslim edildi): ekran guncellensin.
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      notify(t("bookings.cancelFailed"), errorMessage(e, "bookings"));
    },
  });

  // Aktif rezervasyonun bileti cihaza yazilir; ag yoksa QR yine gosterilir.
  const [offline, setOffline] = useState<OfflineTicket | null>(null);
  useEffect(() => {
    if (mode === "guest" && query.data) void saveOfflineTicket(query.data);
  }, [mode, query.data]);
  /*
    Cihazdaki bilet ekran acilir acilmaz okunur (hata beklenmez): zayif sinyalde
    istek 12 sn + 1 sn + 12 sn sonra hata verir; o sure boyunca donen yukleme
    yerine kayitli bilet hemen gorunur.
  */
  useEffect(() => {
    if (mode === "guest") void loadOfflineTicket(id).then(setOffline);
  }, [mode, id]);

  const cachedTicket = (banner: { tone: "warning" | "brand"; title?: string; body: string }, retry: boolean) => (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Banner tone={banner.tone} title={banner.title} body={banner.body} />
        <BookingTicket booking={offline!} showQr={!isBookingExpired(offline!)} />
        {retry ? <Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} /> : null}
      </ScrollView>
    </SafeAreaView>
  );

  if (query.isLoading && offline) {
    return cachedTicket({ tone: "brand", body: t("bookings.refreshingBody") }, false);
  }
  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <IconButton label={t("common.back")} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.ink} />
          </IconButton>
        </View>
        <Loading />
      </SafeAreaView>
    );
  }
  if (!query.data) {
    // Cevrimdisi yalnizca baglanti hatasi (status 0): 404/403/5xx icin "internet yok" demek yaniltici.
    const noConnection = query.error instanceof ApiError && query.error.status === 0;
    const gone = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 403);
    if (offline && noConnection) {
      return cachedTicket({ tone: "warning", title: t("bookings.offlineTitle"), body: t("bookings.offlineBody") }, true);
    }
    if (gone) {
      return (
        <CenterMessage
          title={t("bookings.notFound")}
          action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
        />
      );
    }
    return (
      <CenterMessage
        title={errorMessage(query.error)}
        action={
          <View style={{ gap: space.sm }}>
            <Button title={t("common.retry")} onPress={() => query.refetch()} />
            <Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />
          </View>
        }
      />
    );
  }

  const b = query.data;
  // Gelinmemis, suresi dolmus rezervasyon: QR / degistir gizlenir; "yeniden rezervasyon" ve kapat kalir.
  const expired = mode === "guest" && isBookingExpired(b);
  const showQr = mode === "guest" && !expired && !["CANCELLED", "CHECKED_OUT"].includes(b.status);

  /** Ayni dukkan, ayni valizler, yeni tarih (simdiden varsayilan pencere). */
  function rebook() {
    const w = defaultWindow();
    search.setBags({ s: b.bagCountS, m: b.bagCountM, xl: b.bagCountXl });
    search.setWindow(w.checkIn, w.checkOut, w.rolled);
    router.push(`/shop/${b.shopId}`);
  }

  function submitCancel() {
    if (cancel.isPending) return;
    cancel.mutate();
  }

  function confirmCancel() {
    Alert.alert(t("bookings.cancelTitle"), t("bookings.cancelBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("bookings.cancelConfirm"), style: "destructive", onPress: submitCancel },
    ]);
  }

  /*
    Suresi dolan rezervasyon eskiden yalnizca "yeniden rezervasyon" sunuyordu ve
    listede asili kaliyordu. Ayni iptal ucu kapatir; sunucu valiz birakildiysa reddeder.
  */
  function confirmCloseExpired() {
    Alert.alert(t("bookings.closeExpiredTitle"), t("bookings.closeExpiredBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("bookings.closeExpiredConfirm"), style: "destructive", onPress: submitCancel },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
      </View>

      <StaleQueryBanner query={query} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
        }
      >
        {mode === "guest" ? (
          <ExpiredBookingActions booking={b} onRebook={rebook} onClose={confirmCloseExpired} closing={cancel.isPending} />
        ) : null}
        {mode === "guest" ? <GuestLateNotice booking={b} /> : null}
        {/* Onay bekleyen duzeltme bilet ve QR'in USTUNDE: misafirin yapmasi gereken tek is bu. */}
        {mode === "guest" ? <GuestBagRevisionCard booking={b} /> : null}
        <BookingTicket
          booking={b}
          showQr={showQr}
          title={mode === "partner" ? b.guestName || t("partner.guest") : undefined}
          subtitle={mode === "partner" ? b.shopName : undefined}
          audience={mode === "partner" ? "staff" : "guest"}
        />
        {showQr ? <WalletPassButton bookingId={b.id} /> : null}

        {/*
          Duzeltme muhur satirlarinin USTUNDE: tezgahta once valiz sayilir, sonra
          muhurler yazilir. Aksi sirada duzeltme yazilmis muhurleri siliyordu;
          artik PartnerBookingActions numaralari bagIndex'e gore koruyor.
        */}
        {mode === "partner" && b.pendingBagRevision ? (
          <Banner
            tone="warning"
            title={t("bagRevision.approvalTitle")}
            body={t("bagRevision.pendingBody", {
              count: b.pendingBagRevision.bagCountS + b.pendingBagRevision.bagCountM + b.pendingBagRevision.bagCountXl,
              total: formatMoney(b.pendingBagRevision.newTotal),
            })}
          />
        ) : null}
        {/* Asil is (teslim al / et) duzeltme kartinin USTUNDE: kucuk telefonda ekran altinda kalmasin. */}
        {mode === "partner" ? <PartnerBookingActions key={b.status} booking={b} /> : null}
        {mode === "partner" ? <GuestContact phone={b.guestPhone} /> : null}
        {mode === "partner" ? (
          <BagRevisionCard key={`rev-${b.status}-${b.bagCountS}-${b.bagCountM}-${b.bagCountXl}`} booking={b} />
        ) : null}


        {mode === "guest" ? (
          <View style={{ gap: space.md }}>
            {isActiveBooking(b) && b.shopAddress ? (
              <View style={styles.address}>
                <AppText variant="label">{t("bookings.address")}</AppText>
                <AppText variant="bodyMedium" selectable>
                  {b.shopAddress}
                </AppText>
                <AppText variant="caption">{t("bookings.addressHint")}</AppText>
              </View>
            ) : null}
            {(isActiveBooking(b) && canNavigate(b)) || b.shopPhone ? (
              <View style={styles.actionRow}>
                {isActiveBooking(b) && canNavigate(b) ? (
                  <Button
                    variant="secondary"
                    style={{ flex: 1 }}
                    title={t("bookings.directions")}
                    onPress={() => openDirections(b)}
                  />
                ) : null}
                {b.shopPhone ? (
                  <Button
                    variant="secondary"
                    style={{ flex: 1 }}
                    title={t("bookings.call")}
                    onPress={() => void Linking.openURL(dialUrl(b.shopPhone)).catch(() => undefined)}
                  />
                ) : null}
              </View>
            ) : null}
            {/*
              Web `BookingDetailActions` ile ayni: dukkana WhatsApp (hazir metin + kisa kod;
              numara wa.me bicimine cevrilemezse cizilmez) ve Google Takvim baglantisi.
            */}
            {b.shopWhatsapp || (isActiveBooking(b) && !expired) ? (
              <View style={styles.actionRow}>
                {b.shopWhatsapp ? (
                  <Button
                    variant="secondary"
                    style={{ flex: 1 }}
                    title={t("guestParity.whatsappShop")}
                    onPress={() =>
                      openUrl(
                        `${waUrl(b.shopWhatsapp!)}?text=${encodeURIComponent(
                          t("guestParity.whatsappMessage", { code: bookingCode(b.id) }),
                        )}`,
                      )
                    }
                  />
                ) : null}
                {isActiveBooking(b) && !expired ? (
                  <Button
                    variant="secondary"
                    style={{ flex: 1 }}
                    title={t("guestParity.addToCalendar")}
                    onPress={() =>
                      openUrl(
                        googleCalendarUrl({
                          title: t("guestParity.calendarTitle", { shop: b.shopName }),
                          details: t("guestParity.calendarDetails", { code: bookingCode(b.id), shop: b.shopName }),
                          location: b.shopAddress ?? null,
                          start: b.checkInTime,
                          end: b.checkOutTime,
                        }),
                      )
                    }
                  />
                ) : null}
              </View>
            ) : null}
            {!expired && MODIFIABLE.has(b.status) ? (
              <Button
                variant="secondary"
                title={t("modify.open")}
                onPress={() => router.push({ pathname: "/bookings/modify", params: { id: b.id } })}
              />
            ) : null}
            <GuestReviewCard key={`review-${b.status}`} booking={b} onOpen={revealForm} />
            <GuestDisputeCard key={`dispute-${b.status}`} booking={b} onOpen={revealForm} />
            {!expired && CANCELLABLE.has(b.status) ? (
              <Button
                variant="ghost"
                title={t("bookings.cancel")}
                loading={cancel.isPending}
                onPress={confirmCancel}
                style={{ marginTop: space.sm }}
                textColor={colors.danger}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  address: {
    gap: 4,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.xl, paddingTop: space.sm },
  content: { padding: space.xl, paddingTop: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  actionRow: { flexDirection: "row", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
});
