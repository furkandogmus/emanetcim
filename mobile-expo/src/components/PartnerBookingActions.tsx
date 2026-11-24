import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card } from "@/components/ui";
import { Input } from "@/components/Field";
import { ReasonSheet } from "@/components/ReasonSheet";
import { ApiError, api } from "@/lib/api";
import {
  BOOKING_ACTIONS_NS,
  PARTNER_CANCEL_REASONS,
  canPartnerCancel,
  isSameWallDay,
  lateDropoffState,
  noShowState,
  partnerCancelBody,
} from "@/lib/booking-actions";
import { errorMessage } from "@/lib/errors";
import { buildCheckInBody, shouldOfferOutsideHours } from "@/lib/check-in-request";
import { SEALS_ENABLED } from "@/lib/config";
import { formatDayTime, formatMoney, formatTime } from "@/lib/format";
import { usePartnerCancel, usePartnerDashboard, usePartnerLateHold, usePartnerNoShow, usePartnerShop } from "@/lib/queries";
import { accessForShop } from "@/lib/shop-access";
import type { BookingDetail, PartnerCancelReason } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, radius, space } from "@/theme/tokens";

type BagSize = "S" | "M" | "XL";
/** Valiz satirinda boyutu yazidan once gorsel anlatir; arama ekranindaki renderlarla ayni. */
const BAG_IMAGES: Record<BagSize, number> = {
  S: require("../../assets/bags/s.webp"),
  M: require("../../assets/bags/m.webp"),
  XL: require("../../assets/bags/xl.webp"),
};

type SealRow = { bagIndex: number; bagSize: BagSize; sealNumber: string };

/** Siralama `BookingSeal.bagIndex` ile ayni: once S, sonra M, sonra XL (web `CheckInDialog`). */
function buildSealRows(b: BookingDetail): SealRow[] {
  const rows: SealRow[] = [];
  let index = 0;
  const push = (size: BagSize, n: number) => {
    for (let i = 0; i < n; i++) rows.push({ bagIndex: index++, bagSize: size, sealNumber: "" });
  };
  push("S", b.bagCountS);
  push("M", b.bagCountM);
  push("XL", b.bagCountXl);
  return rows;
}

const CHECK_IN_READY = new Set(["APPROVED", "PAID"]);

/**
 * Esnafin teslim al / teslim et adimlari. Kurallar sunucuda
 * (`services/booking/check-in.ts`): dukkan kapaliysa, odeme yoksa ya da ayar
 * mühür istiyorsa sunucu reddeder; burada yalnizca kod cevrilir.
 */
export function PartnerBookingActions({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /*
    Yazilan muhur numaralari bagIndex'e gore tutulur, satirlar valiz sayisindan
    TURETILIR. Valiz sayisi duzeltilince satirlar yenilenir ama yazilmis numaralar
    kalir; eskiden kart sayilara gore yeniden kuruluyor ve hepsi siliniyordu.
  */
  const [typed, setTyped] = useState<Record<number, string>>({});
  /*
    Muhur adimi SUNUCUNUN ayarina bakar (`requireSealsOnCheckIn`), derleme sabitine
    degil: yonetici ayari acarsa her check-in `SEAL_REQUIRED` ile reddedilir ve
    esnafin yazacagi bir alan olmazdi. Sabit yalnizca ayar okunamazsa yedek.
    Ayar eski bir degerle onbellekte kalmissa SEAL_REQUIRED yaniti da alanlari acar.
  */
  const router = useRouter();
  // Saat disi istisnasi sahip/yonetici karari (`canOverrideClosedHours`); personele sunulmaz.
  const canOverrideHours = accessForShop(usePartnerDashboard().data, booking.shopId) !== "staff";
  const serverSeals = usePartnerShop().data?.requireSealsOnCheckIn === true;
  const [sealsForced, setSealsForced] = useState(false);
  const sealsOn = SEALS_ENABLED || serverSeals || sealsForced;
  const rows = (sealsOn ? buildSealRows(booking) : []).map((r) => ({ ...r, sealNumber: typed[r.bagIndex] ?? "" }));
  // Muhur basina karar: saglam ya da saglam degil (FAULTY, teslim yine tamamlanir).
  const [sealState, setSealState] = useState<Record<number, "intact" | "broken">>({});
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["partner"] });
  };

  /*
    Zayif baglantida istek zaman asimina ugrayabilir ama sunucu islemi yapmis
    olabilir; tekrar denemek "durum uygun degil" hatasi verirdi. Ag hatasinda ya
    da INVALID_STATUS'ta rezervasyon yeniden okunur: is olduysa basari gosterilir.
  */
  async function settledAs(e: unknown, done: string): Promise<boolean> {
    if (!(e instanceof ApiError) || (e.code !== "network" && e.code !== "INVALID_STATUS")) return false;
    const fresh = await api<BookingDetail>(`/bookings/${booking.id}`).catch(() => null);
    return fresh?.status === done;
  }

  const checkIn = useMutation({
    mutationFn: (vars: { outsideHours?: boolean }) =>
      api(`/bookings/${booking.id}/check-in`, { method: "POST", body: buildCheckInBody(rows, vars) }),
    onSuccess: () => {
      setError(null);
      setClosed(false);
      refresh();
      notify(t("partner.checkedInTitle"), t("partner.checkedInBody"));
    },
    onError: async (e, vars) => {
      if (await settledAs(e, "CHECKED_IN")) {
        setError(null);
        refresh();
        notify(t("partner.checkedInTitle"), t("partner.checkedInBody"));
        return;
      }
      if (e instanceof ApiError && e.code === "SEAL_REQUIRED") setSealsForced(true);
      const shopClosed = e instanceof ApiError && e.code === "SHOP_CLOSED";
      setClosed(shopClosed && canOverrideHours);
      setError(shopClosed && !canOverrideHours ? t("shopStaff.closedAskOwner") : errorMessage(e, "partner"));
      /*
        Kayitli saatler cogu dukkanda varsayilanda kaldi; tezgahtaki esnaf dukkanin
        acik oldugunu bilir. Onaylarsa sunucu teslimi saat disi diye kaydeder.
      */
      if (canOverrideHours && shouldOfferOutsideHours(e, vars.outsideHours === true)) confirmOutsideHours();
    },
  });

  function confirmOutsideHours() {
    Alert.alert(t("partner.outsideHoursTitle"), t("partner.outsideHoursBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("partner.editHours"), onPress: () => router.push("/partner/schedule") },
      { text: t("partner.outsideHoursConfirm"), onPress: () => checkIn.mutate({ outsideHours: true }) },
    ]);
  }

  const checkOut = useMutation({
    mutationFn: () => {
      const brokenSealNumbers = Object.entries(sealState)
        .filter(([, v]) => v === "broken")
        .map(([n]) => Number(n));
      return api<{ ok: true; lateFee?: number; refundAmount?: number }>(`/bookings/${booking.id}/check-out`, {
        method: "POST",
        body: { brokenSealNumbers },
      });
    },
    onSuccess: (res) => {
      setError(null);
      refresh();
      const parts = [t("partner.checkedOutBody")];
      if (res.lateFee) parts.push(t("partner.lateFeeCollect", { amount: formatMoney(res.lateFee) }));
      if (res.refundAmount) parts.push(t("partner.earlyRefundGive", { amount: formatMoney(res.refundAmount) }));
      notify(t("partner.checkedOutTitle"), parts.join(" "));
    },
    onError: async (e) => {
      if (await settledAs(e, "CHECKED_OUT")) {
        setError(null);
        refresh();
        notify(t("partner.checkedOutTitle"), t("partner.checkedOutBody"));
        return;
      }
      setError(errorMessage(e, "partner"));
    },
  });

  /*
    Manual saglayicida (dukkanda tahsilat) check-in, parayi "alindi" diye deftere
    yazar ve geri alinamaz. Eskiden tek dokunusla, tutar gosterilmeden oluyordu.
    Online odenmis (PAID) rezervasyonda tahsilat yok, yalnizca teslim.
  */
  const collects = booking.status === "APPROVED";
  const amount = formatMoney(booking.totalPrice);
  const bagCount = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  function confirmCheckIn() {
    Alert.alert(
      t("partner.confirmCheckInTitle"),
      collects
        ? t("partner.confirmCheckInCash", { amount, count: bagCount })
        : t("partner.confirmCheckInPaid", { count: bagCount }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("partner.confirmYes"), onPress: () => checkIn.mutate({}) },
      ],
    );
  }
  function confirmCheckOut() {
    Alert.alert(t("partner.confirmCheckOutTitle"), t("partner.confirmCheckOutBody", { count: bagCount }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("partner.confirmYes"), onPress: () => checkOut.mutate() },
    ]);
  }

  if (CHECK_IN_READY.has(booking.status)) {
    const filled = rows.filter((r) => r.sealNumber !== "").length;
    const partial = filled > 0 && filled !== rows.length;
    return (
      <Card style={styles.card}>
        <AppText variant="heading">{t("partner.checkInTitle")}</AppText>
        <AppText variant="caption">{t(sealsOn ? "partner.checkInHint" : "partner.checkInHintNoSeals")}</AppText>
        {rows.map((r) => (
          <View key={r.bagIndex} style={styles.sealRow}>
            <View style={styles.bagThumb}>
              <Image source={BAG_IMAGES[r.bagSize]} style={{ width: 28, height: 32 }} contentFit="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText
                variant="bodyMedium"
                nativeID={`seal-${r.bagIndex}`}
                accessibilityLabel={t("partner.bagN", { n: r.bagIndex + 1, size: t(`bags.${r.bagSize.toLowerCase()}`) })}
              >
                {t("partner.bagNumber", { n: r.bagIndex + 1 })}
              </AppText>
              <AppText variant="caption" style={{ fontSize: 13 }}>
                {t(`bags.${r.bagSize.toLowerCase()}`)}
              </AppText>
            </View>
            <Input
              style={styles.sealInput}
              accessibilityLabelledBy={`seal-${r.bagIndex}`}
              accessibilityLabel={t("partner.sealNumber")}
              value={r.sealNumber}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, "").slice(0, 10);
                setTyped((prev) => ({ ...prev, [r.bagIndex]: digits }));
              }}
              placeholder={t("partner.sealNumber")}
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
            />
          </View>
        ))}
        {partial ? <Banner tone="warning" body={t("partner.sealsPartial")} /> : null}
        {error ? <Banner tone="danger" body={error} /> : null}
        {closed ? (
          <>
            <Button variant="secondary" title={t("partner.outsideHoursConfirm")} onPress={confirmOutsideHours} />
            <Button variant="ghost" title={t("partner.editHours")} onPress={() => router.push("/partner/schedule")} />
          </>
        ) : null}
        <Button
          title={collects ? t("partner.checkInCtaCash", { amount }) : t("partner.checkInCta")}
          loading={checkIn.isPending}
          disabled={partial}
          onPress={confirmCheckIn}
        />
        <PartnerManageActions booking={booking} />
      </Card>
    );
  }

  if (booking.status === "CHECKED_IN") {
    const seals = booking.seals ?? [];
    const allDecided = seals.every((s) => sealState[s.sealNumber] !== undefined);
    const preview = booking.checkoutPreview;
    return (
      <Card style={styles.card}>
        <AppText variant="heading">{t("partner.checkOutTitle")}</AppText>
        <AppText variant="caption">
          {seals.length ? t("partner.checkOutSealsHint") : t("partner.checkOutHint")}
        </AppText>
        {seals.map((s) => {
          const state = sealState[s.sealNumber];
          const on = state === "intact";
          const broken = state === "broken";
          const set = (v: "intact" | "broken") =>
            setSealState((prev) => {
              const next = { ...prev };
              if (next[s.sealNumber] === v) delete next[s.sealNumber];
              else next[s.sealNumber] = v;
              return next;
            });
          return (
            <View key={s.sealNumber} style={[styles.sealCheck, on && styles.sealCheckOn, broken && styles.sealCheckBroken]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => set("intact")}
                style={styles.sealMain}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on ? <Check size={16} color={colors.white} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{t("partner.sealIntact", { n: s.sealNumber })}</AppText>
                  <AppText variant="caption">{t(`bags.${s.bagSize.toLowerCase()}`)}</AppText>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: broken }}
                onPress={() => set("broken")}
                hitSlop={8}
                style={[styles.brokenChip, broken && styles.brokenChipOn]}
              >
                <AppText variant="caption" style={{ color: broken ? colors.danger : colors.inkSecondary }}>
                  {t("partner.sealBroken")}
                </AppText>
              </Pressable>
            </View>
          );
        })}
        {Object.values(sealState).includes("broken") ? (
          <Banner tone="warning" body={t("partner.sealBrokenHint")} />
        ) : null}
        {preview?.lateFeeTry ? (
          <Banner tone="warning" body={t("partner.lateFeeCollect", { amount: formatMoney(preview.lateFeeTry) })} />
        ) : null}
        {preview?.earlyRefund ? (
          <Banner tone="warning" body={t("partner.earlyRefundGive", { amount: formatMoney(preview.earlyRefund) })} />
        ) : null}
        {error ? <Banner tone="danger" body={error} /> : null}
        <Button
          title={t("partner.checkOutCta")}
          loading={checkOut.isPending}
          disabled={!allDecided}
          onPress={confirmCheckOut}
        />
      </Card>
    );
  }

  if (canPartnerCancel(booking.status)) {
    return (
      <Card style={styles.card}>
        <PartnerManageActions booking={booking} />
      </Card>
    );
  }

  return null;
}

/** setTimeout ~24,8 gunden uzun gecikmede hemen tetiklenir. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Teslim almadan once esnafin ikincil islemleri: "Misafir gelmedi" (sunucu
 * `noShowAvailableAt` verdiyse, o andan sonra) ve nedenli iptal. Asil is teslim
 * almak oldugu icin ikisi de ikincil gorunumde, teslim dugmesinin altinda.
 */
function PartnerManageActions({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  // Iptal `manage`: personelde dugme yok (sunucu da reddeder); "gelmedi" ve bekleme kalir.
  const canCancel = accessForShop(usePartnerDashboard().data, booking.shopId) !== "staff";
  const cancel = usePartnerCancel(booking.id);
  const noShow = usePartnerNoShow(booking.id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PartnerCancelReason | null>(null);
  const [note, setNote] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bekleme bitince dugme ekran acikken de acilsin: an tek zamanlayiciyla ilerletilir.
  const [now, setNow] = useState(() => Date.now());
  const state = noShowState(booking.noShowAvailableAt, now);
  const waitUntil = state.kind === "waiting" ? state.at.getTime() : null;
  useEffect(() => {
    if (waitUntil === null) return;
    const id = setTimeout(() => setNow(Date.now()), Math.min(Math.max(waitUntil - Date.now(), 0) + 250, MAX_TIMER_MS));
    return () => clearTimeout(id);
  }, [waitUntil, now]);

  const body = partnerCancelBody(reason, note);

  function submitCancel() {
    if (!body || cancel.isPending) return;
    setSheetError(null);
    cancel.mutate(body, {
      onSuccess: () => {
        setOpen(false);
        notify(t("bookingActions.partner.cancelledTitle"), t("bookingActions.partner.cancelledBody"));
      },
      onError: (e) => setSheetError(errorMessage(e, BOOKING_ACTIONS_NS)),
    });
  }

  function confirmNoShow() {
    Alert.alert(t("bookingActions.partner.noShowTitle"), t("bookingActions.partner.noShowBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("bookingActions.partner.noShowConfirm"),
        style: "destructive",
        onPress: () => {
          if (noShow.isPending) return;
          setError(null);
          noShow.mutate(undefined, {
            onSuccess: () => notify(t("bookingActions.partner.noShowDoneTitle"), t("bookingActions.partner.noShowDoneBody")),
            onError: (e) => setError(errorMessage(e, BOOKING_ACTIONS_NS)),
          });
        },
      },
    ]);
  }

  const hold = usePartnerLateHold(booking.id);
  const late = lateDropoffState(booking, now);
  function submitHold() {
    if (hold.isPending) return;
    setError(null);
    hold.mutate(undefined, {
      onSuccess: () => notify(t("bookingActions.partner.lateHoldDoneTitle"), t("bookingActions.partner.lateHoldDoneBody")),
      onError: (e) => setError(errorMessage(e, BOOKING_ACTIONS_NS)),
    });
  }

  const busy = cancel.isPending || noShow.isPending || hold.isPending;
  const waitingLabel =
    state.kind === "waiting"
      ? t("bookingActions.partner.noShowAt", {
          time: isSameWallDay(state.at, new Date(now)) ? formatTime(state.at) : formatDayTime(state.at),
        })
      : null;

  return (
    <View style={{ gap: space.sm }}>
      {error ? <Banner tone="danger" body={error} /> : null}
      {late.kind === "late" && late.actionable ? (
        <View style={{ gap: space.sm }}>
          <Banner
            tone="warning"
            title={t("bookingActions.partner.lateTitle")}
            body={[
              t("bookingActions.partner.lateCloseAt", { time: formatTime(late.closeAt) }),
              late.holdUntil ? t("bookingActions.partner.lateHoldActive", { time: formatTime(late.holdUntil) }) : null,
              t("bookingActions.partner.lateHint"),
            ]
              .filter(Boolean)
              .join("\n")}
          />
          <Button
            variant="secondary"
            title={t("bookingActions.partner.lateHold")}
            disabled={!late.canHold || busy}
            loading={hold.isPending}
            onPress={submitHold}
          />
          {!late.canHold ? (
            <AppText variant="caption" style={{ textAlign: "center" }}>
              {t("bookingActions.partner.lateHoldLimit")}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {state.kind !== "hidden" ? (
        <View style={{ gap: 4 }}>
          <Button
            variant="secondary"
            title={t("bookingActions.partner.noShow")}
            disabled={state.kind === "waiting" || busy}
            loading={noShow.isPending}
            onPress={confirmNoShow}
            accessibilityHint={waitingLabel ?? undefined}
          />
          {waitingLabel ? (
            <AppText variant="caption" style={{ textAlign: "center" }}>
              {waitingLabel}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {canCancel ? (
        <Button
          variant="ghost"
          textColor={colors.danger}
          title={t("bookingActions.partner.cancel")}
          disabled={busy}
          onPress={() => {
            setSheetError(null);
            setOpen(true);
          }}
        />
      ) : null}
      <ReasonSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t("bookingActions.partner.cancelTitle")}
        body={t("bookingActions.partner.cancelBody")}
        choices={PARTNER_CANCEL_REASONS.map((r) => ({ value: r, label: t(`bookingActions.reasons.${r}`) }))}
        selected={reason}
        onSelect={(v) => setReason(v as PartnerCancelReason)}
        note={note}
        onNoteChange={setNote}
        noteLabel={t("bookingActions.partner.noteLabel")}
        notePlaceholder={t(reason === "other" ? "bookingActions.partner.noteRequired" : "bookingActions.partner.noteOptional")}
        noteHint={reason === "other" ? t("bookingActions.partner.noteRequiredHint") : undefined}
        confirmLabel={t("bookingActions.partner.cancelConfirm")}
        canSubmit={body !== null}
        loading={cancel.isPending}
        error={sheetError}
        onConfirm={submitCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  sealRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  bagThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.inner,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  sealInput: { width: 124, fontFamily: fonts.monoMedium },
  sealCheck: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sealCheckOn: { borderColor: colors.success },
  sealCheckBroken: { borderColor: colors.danger },
  sealMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md },
  brokenChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brokenChipOn: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
});
