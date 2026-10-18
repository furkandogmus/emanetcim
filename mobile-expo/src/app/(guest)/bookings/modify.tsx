import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BagCounter } from "@/components/BagCounter";
import { StayWindowPicker, isStayWindowValid } from "@/components/StayWindowPicker";
import { AppText, Banner, Button, Card, CenterMessage, Divider, IconButton, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney, stayDays } from "@/lib/format";
import { estimate } from "@/lib/pricing";
import { useBooking, useShop } from "@/lib/queries";
import { totalBags } from "@/lib/search";
import type { BookingDetail, ModifyBookingRequest, ModifyBookingResponse } from "@/lib/types";
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
  const shopQuery = useShop(b.shopId);
  const [checkIn, setCheckIn] = useState(() => new Date(b.checkInTime));
  const [checkOut, setCheckOut] = useState(() => new Date(b.checkOutTime));
  const [bags, setBags] = useState({ s: b.bagCountS, m: b.bagCountM, xl: b.bagCountXl });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: ModifyBookingRequest) =>
      api<ModifyBookingResponse>(`/bookings/${b.id}/modify`, { method: "PUT", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      Alert.alert(t("modify.savedTitle"), t("modify.savedBody"));
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

  /*
    Sunucu yeni tutardan rezervasyonda kilitli kupon/referans indirimini duser
    (`modifyBooking`). O alanlar mobil DTO'da yok; indirim, mevcut rezervasyonun
    tahmini ile sunucudaki `totalPrice` farkindan cikarilir. Bu olmadan kuponlu,
    odenmis bir rezervasyonda tutari degistirmeyen bir saat kaydirmasi bile
    "tutar degisir" uyarisi gosterirdi.
  */
  const shop = shopQuery.data;
  const lockedDiscount = shop
    ? Math.max(
        0,
        estimate(
          shop,
          { s: b.bagCountS, m: b.bagCountM, xl: b.bagCountXl },
          stayDays(new Date(b.checkInTime), new Date(b.checkOutTime)),
        ).total - b.totalPrice,
      )
    : 0;
  const newTotal =
    shop && windowValid && bagCount > 0
      ? Math.max(
          0,
          Math.round((estimate(shop, bags, stayDays(checkIn, checkOut)).total - lockedDiscount) * 100) / 100,
        )
      : null;
  /*
    Sunucu (`modifyBooking`) odemesi alinmis rezervasyonda tutarin DEGISMESINI
    `PRICE_INCREASE` ile reddeder -- dusus dahil. PaymentLog istemcide gorunmez,
    o yuzden uyari yalnizca PAID icin; diger durumda sunucu hatasi cevrilir.
  */
  const paidPriceChange = b.status === "PAID" && newTotal !== null && Math.abs(newTotal - b.totalPrice) > 0.005;

  function save() {
    setError(null);
    mutation.mutate({
      checkInTime: checkIn.toISOString(),
      checkOutTime: checkOut.toISOString(),
      bagCountS: bags.s,
      bagCountM: bags.m,
      bagCountXl: bags.xl,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("modify.title")}</AppText>
        <View style={{ width: 44 }} />
      </View>

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
              <AppText variant="caption">{t("modify.estimateNote")}</AppText>
            </>
          ) : null}
        </Card>

        {paidPriceChange ? <Banner tone="warning" body={t("modify.paidNote")} /> : null}
        {error ? <Banner tone="danger" body={error} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t("modify.save")}
          loading={mutation.isPending}
          disabled={!changed || !windowValid || bagCount === 0}
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
