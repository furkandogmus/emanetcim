import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { BagCounter } from "@/components/BagCounter";
import { StayWindowPicker, isStayWindowValid } from "@/components/StayWindowPicker";
import { StackHeader } from "@/components/StackHeader";
import { AppText, Banner, Button, Card, CenterMessage, Divider, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { useBooking } from "@/lib/queries";
import { totalBags } from "@/lib/search";
import type { BookingDetail, ModifyBookingPreview, ModifyBookingRequest, ModifyBookingResponse } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, space } from "@/theme/tokens";

export default function ModifyBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const query = useBooking(id);

  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data) {
    return (
      <CenterMessage
        title={errorMessage(query.error)}
        action={<Button variant="secondary" title={t("common.back")} onPress={() => router.back()} />}
      />
    );
  }
  // Rezervasyon geldikten sonra kurulur: baslangic degerleri sunucudaki hali.
  return <ModifyForm booking={query.data} />;
}

function ModifyForm({ booking: b }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [checkIn, setCheckIn] = useState(() => new Date(b.checkInTime));
  const [checkOut, setCheckOut] = useState(() => new Date(b.checkOutTime));
  const [bags, setBags] = useState({ s: b.bagCountS, m: b.bagCountM, xl: b.bagCountXl });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: ModifyBookingRequest) =>
      api<ModifyBookingResponse>(`/bookings/${b.id}/modify`, { method: "PUT", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      notify(t("modify.savedTitle"), t("modify.savedBody"));
      router.back();
    },
    onError: (e) => setError(errorMessage(e, "modify")),
  });

  const windowValid = isStayWindowValid(checkIn, checkOut);
  const bagCount = totalBags(bags);
  const changed =
    checkIn.getTime() !== new Date(b.checkInTime).getTime() ||
    checkOut.getTime() !== new Date(b.checkOutTime).getTime() ||
    bags.s !== b.bagCountS ||
    bags.m !== b.bagCountM ||
    bags.xl !== b.bagCountXl;

  const body: ModifyBookingRequest = {
    checkInTime: checkIn.toISOString(),
    checkOutTime: checkOut.toISOString(),
    bagCountS: bags.s,
    bagCountM: bags.m,
    bagCountXl: bags.xl,
  };
  /*
    Yeni tutar YALNIZCA sunucudan: ayni `modifyBooking`, yazmadan (`?preview=1`).
    Ekran eskiden fiyati kendi formuluyle, kilitli indirimi de fark hesabiyla
    "tahmin" ediyordu; kapali saat ve odenmis rezervasyon kurali da ancak
    kaydederken ogreniliyordu.
  */
  const preview = useQuery({
    enabled: changed && windowValid && bagCount > 0,
    queryKey: ["bookings", b.id, "modify-preview", body],
    queryFn: () =>
      api<ModifyBookingPreview>(`/bookings/${b.id}/modify?preview=1`, { method: "PUT", body }),
    retry: false,
  });
  const newTotal = changed ? (preview.data?.newTotal ?? null) : null;
  const paidPriceChange = !!preview.data?.priceChangeBlocked;
  const previewError = changed && preview.isError ? errorMessage(preview.error, "modify") : null;

  function save() {
    setError(null);
    mutation.mutate(body);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StackHeader title={t("modify.title")} />

      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="caption">{b.shopName}</AppText>

        <AppText variant="title">{t("modify.whenTitle")}</AppText>
        <StayWindowPicker
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={(ci, co) => {
            setCheckIn(ci);
            setCheckOut(co);
          }}
        />

        <AppText variant="title">{t("modify.bagsTitle")}</AppText>
        <BagCounter size="s" value={bags.s} onChange={(s) => setBags({ ...bags, s })} />
        <BagCounter size="m" value={bags.m} onChange={(m) => setBags({ ...bags, m })} />
        <BagCounter size="xl" value={bags.xl} onChange={(xl) => setBags({ ...bags, xl })} />
        {bagCount === 0 ? <Banner tone="warning" body={t("modify.noBags")} /> : null}

        <Card style={{ gap: space.sm }}>
          <View style={styles.row}>
            <AppText variant="body">{t("modify.currentTotal")}</AppText>
            <AppText variant="body">{formatMoney(b.totalPrice)}</AppText>
          </View>
          {newTotal !== null ? (
            <>
              <Divider />
              <View style={styles.row}>
                <AppText variant="heading" style={{ flex: 1 }}>
                  {t("modify.newTotal")}
                </AppText>
                <AppText variant="heading" style={{ fontFamily: fonts.display, fontSize: 22 }}>
                  {formatMoney(newTotal)}
                </AppText>
              </View>
            </>
          ) : null}
        </Card>

        {paidPriceChange ? <Banner tone="warning" body={t("modify.paidNote")} /> : null}
        {previewError ? <Banner tone="danger" body={previewError} /> : null}
        {error ? <Banner tone="danger" body={error} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t("modify.save")}
          loading={mutation.isPending}
          disabled={!changed || !windowValid || bagCount === 0 || paidPriceChange || !!previewError || preview.isFetching}
          onPress={save}
        />
      </View>
    </SafeAreaView>
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  footer: { padding: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
