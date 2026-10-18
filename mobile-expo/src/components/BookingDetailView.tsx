import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { ArrowLeft, Navigation, Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { PartnerBookingActions } from "@/components/PartnerBookingActions";
import { StatusBadge } from "@/components/StatusBadge";
import { AppText, Banner, Button, Card, CenterMessage, Divider, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDayTime, formatMoney } from "@/lib/format";
import { isActiveBooking, keys, useBooking } from "@/lib/queries";
import type { BookingDetail } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Misafirin iptal edebildigi durumlar: valiz henuz dukkana teslim edilmemis. */
const CANCELLABLE = new Set(["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"]);

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

  const cancel = useMutation({
    mutationFn: () => api<{ success: boolean; fullRefund: boolean }>(`/bookings/${id}/cancel`, { method: "DELETE" }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      // Sunucuda `fullRefund = hadPayment` (lifecycle.ts): false "kismi ucret"
      // DEGIL, "hic odeme alinmamisti" demek -- dukkanda odeme modunda hep boyle.
      Alert.alert(
        t("bookings.cancelledTitle"),
        res.fullRefund ? t("bookings.cancelledRefund") : t("bookings.cancelledNoCharge"),
      );
    },
    onError: (e) => Alert.alert(t("bookings.cancelFailed"), errorMessage(e)),
  });

  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data) {
    return (
      <CenterMessage
        title={errorMessage(query.error)}
        action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
      />
    );
  }

  const b = query.data;
  const showQr = mode === "guest" && !["CANCELLED", "CHECKED_OUT"].includes(b.status);
  const bagLines = [
    { size: "s", count: b.bagCountS },
    { size: "m", count: b.bagCountM },
    { size: "xl", count: b.bagCountXl },
  ].filter((l) => l.count > 0);

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

      <ScrollView contentContainerStyle={styles.content}>
        <StatusBadge status={b.status} />
        <AppText variant="title">{mode === "partner" ? b.guestName || t("partner.guest") : b.shopName}</AppText>
        {mode === "partner" ? <AppText variant="caption">{b.shopName}</AppText> : null}

        {showQr ? (
          <Card style={styles.qrCard}>
            {b.qrCodeToken ? (
              <>
                <QRCode value={b.qrCodeToken} size={208} color={colors.ink} backgroundColor={colors.surface} />
                <AppText variant="bodyMedium" style={{ textAlign: "center" }}>
                  {t("bookings.showQr")}
                </AppText>
              </>
            ) : (
              <Banner tone="warning" body={t("bookings.qrMissing")} />
            )}
          </Card>
        ) : null}

        {mode === "partner" ? <PartnerBookingActions key={b.status} booking={b} /> : null}

        <Card style={{ gap: space.md }}>
          {/* Web'deki "Rezervasyon kodu" ile ayni: QR okunamazsa telefonda soylenen kod. */}
          <Row label={t("bookings.code")} value={b.id.slice(0, 8).toUpperCase()} />
          <Divider />
          <Row label={t("bookings.dropOff")} value={formatDayTime(b.checkInTime)} />
          <Row label={t("bookings.pickUp")} value={formatDayTime(b.checkOutTime)} />
          <Divider />
          {bagLines.map((l) => (
            <Row key={l.size} label={t(`bags.${l.size}`)} value={`× ${l.count}`} />
          ))}
          <Divider />
          <View style={styles.row}>
            <AppText variant="heading">{t("bookings.total")}</AppText>
            <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
              {formatMoney(b.totalPrice)}
            </AppText>
          </View>
        </Card>

        {mode === "guest" ? (
          <View style={{ gap: space.md }}>
            {isActiveBooking(b) && b.latitude != null && b.longitude != null ? (
              <Button
                variant="secondary"
                title={t("bookings.directions")}
                icon={<Navigation size={18} color={colors.ink} />}
                onPress={() => openDirections(b)}
              />
            ) : null}
            {b.shopPhone ? (
              <Button
                variant="secondary"
                title={t("bookings.call")}
                icon={<Phone size={18} color={colors.ink} />}
                onPress={() => void Linking.openURL(`tel:${b.shopPhone}`).catch(() => undefined)}
              />
            ) : null}
            {CANCELLABLE.has(b.status) ? (
              <Button variant="danger" title={t("bookings.cancel")} loading={cancel.isPending} onPress={confirmCancel} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="bodyMedium">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.xl, paddingTop: space.sm },
  content: { padding: space.xl, gap: space.lg },
  qrCard: { alignItems: "center", gap: space.lg, paddingVertical: space.xl, borderRadius: radius.card },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
});
