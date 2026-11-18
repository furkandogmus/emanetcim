import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagRevisionCard } from "@/components/BagRevisionCard";
import { BookingTicket } from "@/components/BookingTicket";
import { GuestBagRevisionCard } from "@/components/GuestBagRevisionCard";
import { GuestDisputeCard } from "@/components/GuestDisputeCard";
import { GuestReviewCard } from "@/components/GuestReviewCard";
import { PartnerBookingActions } from "@/components/PartnerBookingActions";
import { Banner, Button, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { isActiveBooking, useBooking } from "@/lib/queries";
import type { BookingDetail } from "@/lib/types";
import { notify } from "@/lib/notify";
import { loadOfflineTicket, saveOfflineTicket, type OfflineTicket } from "@/lib/offline-tickets";
import { colors, space } from "@/theme/tokens";

/** Misafirin iptal edebildigi durumlar: valiz henuz dukkana teslim edilmemis. */
const CANCELLABLE = new Set(["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"]);
/** `modifyBooking` (lifecycle.ts) yalnizca CHECKED_IN / CHECKED_OUT / CANCELLED'i reddeder. */
const MODIFIABLE = CANCELLABLE;

function openDirections(b: BookingDetail) {
  if (b.latitude == null || b.longitude == null) return;
  const q = `${b.latitude},${b.longitude}`;
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${q}`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  void Linking.openURL(url).catch(() => undefined);
}

export function BookingDetailView({ id, mode }: { id: string; mode: "guest" | "partner" }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useBooking(id);
  const scrollRef = useRef<ScrollView>(null);

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
      notify(
        t("bookings.cancelledTitle"),
        res.fullRefund ? t("bookings.cancelledRefund") : t("bookings.cancelledNoCharge"),
      );
    },
    onError: (e) => notify(t("bookings.cancelFailed"), errorMessage(e)),
  });

  // Aktif rezervasyonun bileti cihaza yazilir; ag yoksa QR yine gosterilir.
  const [offline, setOffline] = useState<OfflineTicket | null>(null);
  useEffect(() => {
    if (mode === "guest" && query.data) void saveOfflineTicket(query.data);
  }, [mode, query.data]);
  useEffect(() => {
    if (mode === "guest" && query.isError) void loadOfflineTicket(id).then(setOffline);
  }, [mode, query.isError, id]);

  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data) {
    if (offline) {
      return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.header}>
            <IconButton label={t("common.back")} onPress={() => router.back()}>
              <ArrowLeft size={20} color={colors.ink} />
            </IconButton>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Banner tone="warning" title={t("bookings.offlineTitle")} body={t("bookings.offlineBody")} />
            <BookingTicket booking={offline} showQr />
            <Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />
          </ScrollView>
        </SafeAreaView>
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
  const showQr = mode === "guest" && !["CANCELLED", "CHECKED_OUT"].includes(b.status);

  function confirmCancel() {
    Alert.alert(t("bookings.cancelTitle"), t("bookings.cancelBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("bookings.cancelConfirm"), style: "destructive", onPress: () => cancel.mutate() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
        }
      >
        {/* Onay bekleyen duzeltme bilet ve QR'in USTUNDE: misafirin yapmasi gereken tek is bu. */}
        {mode === "guest" ? <GuestBagRevisionCard booking={b} /> : null}
        <BookingTicket
          booking={b}
          showQr={showQr}
          title={mode === "partner" ? b.guestName || t("partner.guest") : undefined}
          subtitle={mode === "partner" ? b.shopName : undefined}
        />

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
        {mode === "partner" ? (
          <BagRevisionCard key={`rev-${b.status}-${b.bagCountS}-${b.bagCountM}-${b.bagCountXl}`} booking={b} />
        ) : null}
        {mode === "partner" ? <PartnerBookingActions key={b.status} booking={b} /> : null}


        {mode === "guest" ? (
          <View style={{ gap: space.md }}>
            {(isActiveBooking(b) && b.latitude != null && b.longitude != null) || b.shopPhone ? (
              <View style={styles.actionRow}>
                {isActiveBooking(b) && b.latitude != null && b.longitude != null ? (
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
                    onPress={() => void Linking.openURL(`tel:${b.shopPhone}`).catch(() => undefined)}
                  />
                ) : null}
              </View>
            ) : null}
            {MODIFIABLE.has(b.status) ? (
              <Button
                variant="secondary"
                title={t("modify.open")}
                onPress={() => router.push({ pathname: "/bookings/modify", params: { id: b.id } })}
              />
            ) : null}
            <GuestReviewCard key={`review-${b.status}`} booking={b} onOpen={revealForm} />
            <GuestDisputeCard key={`dispute-${b.status}`} booking={b} onOpen={revealForm} />
            {CANCELLABLE.has(b.status) ? (
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
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.xl, paddingTop: space.sm },
  content: { padding: space.xl, paddingTop: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  actionRow: { flexDirection: "row", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
});
