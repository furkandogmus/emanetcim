import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText, Banner, Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { BookingDetail } from "@/lib/types";
import { notify } from "@/lib/notify";
import { colors, fonts, radius, space } from "@/theme/tokens";

type BagSize = "S" | "M" | "XL";
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
  const [rows, setRows] = useState(() => buildSealRows(booking));
  const [returned, setReturned] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["partner"] });
  };

  const checkIn = useMutation({
    mutationFn: () => {
      const sealAssignments = rows
        .filter((r) => r.sealNumber !== "")
        .map((r) => ({ sealNumber: Number(r.sealNumber), bagIndex: r.bagIndex, bagSize: r.bagSize }));
      return api(`/bookings/${booking.id}/check-in`, {
        method: "POST",
        body: sealAssignments.length ? { sealAssignments, faultySealNumbers: [] } : {},
      });
    },
    onSuccess: () => {
      setError(null);
      refresh();
      notify(t("partner.checkedInTitle"), t("partner.checkedInBody"));
    },
    onError: (e) => setError(errorMessage(e, "partner")),
  });

  const checkOut = useMutation({
    mutationFn: () => api(`/bookings/${booking.id}/check-out`, { method: "POST" }),
    onSuccess: () => {
      setError(null);
      refresh();
      notify(t("partner.checkedOutTitle"), t("partner.checkedOutBody"));
    },
    onError: (e) => setError(errorMessage(e, "partner")),
  });

  if (CHECK_IN_READY.has(booking.status)) {
    const filled = rows.filter((r) => r.sealNumber !== "").length;
    const partial = filled > 0 && filled !== rows.length;
    return (
      <Card style={styles.card}>
        <AppText variant="heading">{t("partner.checkInTitle")}</AppText>
        <AppText variant="caption">{t("partner.checkInHint")}</AppText>
        {rows.map((r) => (
          <View key={r.bagIndex} style={styles.sealRow}>
            <AppText variant="bodyMedium" nativeID={`seal-${r.bagIndex}`} style={{ flex: 1 }}>
              {t("partner.bagN", { n: r.bagIndex + 1, size: t(`bags.${r.bagSize.toLowerCase()}`) })}
            </AppText>
            <TextInput
              accessibilityLabelledBy={`seal-${r.bagIndex}`}
              accessibilityLabel={t("partner.sealNumber")}
              value={r.sealNumber}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, "").slice(0, 10);
                setRows((prev) => prev.map((x) => (x.bagIndex === r.bagIndex ? { ...x, sealNumber: digits } : x)));
              }}
              placeholder={t("partner.sealNumber")}
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        ))}
        {partial ? <Banner tone="warning" body={t("partner.sealsPartial")} /> : null}
        {error ? <Banner tone="danger" body={error} /> : null}
        <Button
          title={t("partner.checkInCta")}
          loading={checkIn.isPending}
          disabled={partial}
          onPress={() => checkIn.mutate()}
        />
      </Card>
    );
  }

  if (booking.status === "CHECKED_IN") {
    const seals = booking.seals ?? [];
    const allReturned = seals.every((s) => returned.includes(s.sealNumber));
    return (
      <Card style={styles.card}>
        <AppText variant="heading">{t("partner.checkOutTitle")}</AppText>
        <AppText variant="caption">
          {seals.length ? t("partner.checkOutSealsHint") : t("partner.checkOutHint")}
        </AppText>
        {seals.map((s) => {
          const on = returned.includes(s.sealNumber);
          return (
            <Pressable
              key={s.sealNumber}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() =>
                setReturned((prev) =>
                  on ? prev.filter((n) => n !== s.sealNumber) : [...prev, s.sealNumber],
                )
              }
              style={[styles.sealCheck, on && styles.sealCheckOn]}
            >
              <View style={[styles.box, on && styles.boxOn]}>
                {on ? <Check size={16} color={colors.white} /> : null}
              </View>
              <AppText variant="bodyMedium" style={{ flex: 1 }}>
                {t("partner.sealIntact", { n: s.sealNumber })}
              </AppText>
              <AppText variant="caption">{t(`bags.${s.bagSize.toLowerCase()}`)}</AppText>
            </Pressable>
          );
        })}
        {error ? <Banner tone="danger" body={error} /> : null}
        <Button
          title={t("partner.checkOutCta")}
          loading={checkOut.isPending}
          disabled={!allReturned}
          onPress={() => checkOut.mutate()}
        />
      </Card>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  sealRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  input: {
    width: 150,
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
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
