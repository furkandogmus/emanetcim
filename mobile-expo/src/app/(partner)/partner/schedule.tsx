import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarOff, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { RangeCalendar } from "@/components/Calendar";
import { Field } from "@/components/Field";
import { AppText, Banner, Button, Card, CenterMessage, IconButton, Loading } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { partnerScheduleKey, usePartnerSchedule } from "@/lib/queries";
import { cellOf, wallInstant } from "@/lib/time";
import type { PartnerSchedule, ScheduleConflict, ScheduleDay, ShopClosure } from "@/lib/types";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Sunucudaki `ShopScheduleService.TIME_RE` ile ayni bicim. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const KIND_KEY = {
  dropoff: "schedule.conflictDropoff",
  pickup: "schedule.conflictPickup",
  bags_on_shelf: "schedule.conflictBags",
} as const;

/** "930" / "0930" / "9" -> "09:30" / "09:30" / "09:00"; anlasilmayani oldugu gibi birakir. */
function normalizeTime(raw: string): string {
  const v = raw.trim();
  if (TIME_RE.test(v)) return v;
  const digits = v.replace(/\D/g, "");
  if (digits.length <= 2 && digits.length > 0) return `${digits.padStart(2, "0")}:00`;
  if (digits.length === 3 || digits.length === 4) {
    const p = digits.padStart(4, "0");
    return `${p.slice(0, 2)}:${p.slice(2)}`;
  }
  return v;
}

/** Dukkan gunu "YYYY-MM-DD" -> "Cum 16 Eki". Ogle anı: gun hicbir kaydirmayla tasmasin. */
function formatShopDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return formatDay(wallInstant(y, m - 1, d, 12));
}

/** Takvim hucresi (Istanbul gunu, yerel Date) -> "YYYY-MM-DD". */
function cellToIso(cell: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${cell.getFullYear()}-${pad(cell.getMonth() + 1)}-${pad(cell.getDate())}`;
}

function conflictsOf(e: unknown): ScheduleConflict[] {
  if (!(e instanceof ApiError) || e.code !== "schedule_conflict") return [];
  const body = e.body as { conflicts?: ScheduleConflict[] } | null;
  return Array.isArray(body?.conflicts) ? body.conflicts : [];
}

/**
 * Gun bazli calisma saatleri, 7/24 ve izin gunleri. 7/24 acikken gunluk saatler
 * kullanilmaz, yalnizca izinler gecerlidir (web formu ile ayni). Aktif
 * rezervasyona denk gelen degisikligi sunucu 409 ile reddeder; liste gosterilir.
 */
export default function PartnerScheduleScreen() {
  const { t } = useTranslation();
  const query = usePartnerSchedule();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <IconButton label={t("common.back")} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </IconButton>
        <AppText variant="heading">{t("schedule.title")}</AppText>
        <View style={{ width: 44 }} />
      </View>
      {query.isLoading ? (
        <Loading />
      ) : query.isError || !query.data ? (
        <CenterMessage
          title={errorMessage(query.error, "schedule")}
          action={<Button variant="secondary" title={t("common.retry")} onPress={() => query.refetch()} />}
        />
      ) : (
        <ScheduleForm schedule={query.data} />
      )}
    </SafeAreaView>
  );
}

function ScheduleForm({ schedule }: { schedule: PartnerSchedule }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open247, setOpen247] = useState(schedule.open247);
  const [days, setDays] = useState<ScheduleDay[]>(schedule.days);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState(() => {
    const today = cellOf(new Date());
    return { start: today, end: today };
  });
  const [reason, setReason] = useState("");

  const patch = (weekday: number, next: Partial<ScheduleDay>) =>
    setDays((cur) => cur.map((d) => (d.weekday === weekday ? { ...d, ...next } : d)));

  const onFail = (e: unknown) => {
    setError(errorMessage(e, "schedule"));
    setConflicts(conflictsOf(e));
  };
  const onDone = () => {
    setError(null);
    setConflicts([]);
    void queryClient.invalidateQueries({ queryKey: partnerScheduleKey });
  };

  const saveHours = useMutation({
    mutationFn: (body: { open247: boolean; days: ScheduleDay[] }) =>
      api("/partner/shop/schedule", { method: "PUT", body }),
    onSuccess: () => {
      onDone();
      Alert.alert(t("schedule.saved"));
    },
    onError: onFail,
  });

  const addClosure = useMutation({
    mutationFn: () =>
      api("/partner/shop/schedule", {
        method: "POST",
        body: {
          startDate: cellToIso(range.start),
          endDate: cellToIso(range.end),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      }),
    onSuccess: () => {
      onDone();
      setAdding(false);
      setReason("");
    },
    onError: onFail,
  });

  const removeClosure = useMutation({
    mutationFn: (id: string) =>
      api(`/partner/shop/schedule?closureId=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: onDone,
    onError: onFail,
  });

  function submitHours() {
    const normalized = days.map((d) => ({
      ...d,
      openingTime: normalizeTime(d.openingTime),
      closingTime: normalizeTime(d.closingTime),
    }));
    setDays(normalized);
    // Kapali gunun saati sunucuda yok sayilir; 7/24'te de gunluk saatler kullanilmaz.
    const bad = !open247 && normalized.some((d) => !d.isClosed && (!TIME_RE.test(d.openingTime) || !TIME_RE.test(d.closingTime)));
    if (bad) {
      setError(t("schedule.timeInvalid"));
      setConflicts([]);
      return;
    }
    saveHours.mutate({ open247, days: normalized });
  }

  function confirmRemove(c: ShopClosure) {
    Alert.alert(t("schedule.removeTitle"), closureLabel(c), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("schedule.remove"), style: "destructive", onPress: () => removeClosure.mutate(c.id) },
    ]);
  }

  const busy = saveHours.isPending || addClosure.isPending || removeClosure.isPending;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="caption">{t("schedule.hint")}</AppText>

        <Card style={styles.switchRow}>
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="bodyMedium">{t("schedule.open247")}</AppText>
            <AppText variant="caption">{t("schedule.open247Hint")}</AppText>
          </View>
          <Switch
            accessibilityLabel={t("schedule.open247")}
            value={open247}
            onValueChange={setOpen247}
            trackColor={{ true: colors.accent, false: colors.borderStrong }}
            thumbColor={colors.white}
          />
        </Card>

        {!open247 &&
          days.map((d) => {
            const name = t(`schedule.days.${d.weekday}`);
            return (
              <View key={d.weekday} style={styles.dayRow}>
                <AppText variant="bodyMedium" style={styles.dayName}>
                  {name}
                </AppText>
                {d.isClosed ? (
                  <AppText variant="caption" style={{ flex: 1 }}>
                    {t("schedule.closed")}
                  </AppText>
                ) : (
                  <View style={styles.times}>
                    <TextInput
                      accessibilityLabel={t("schedule.openingFor", { day: name })}
                      value={d.openingTime}
                      onChangeText={(v) => patch(d.weekday, { openingTime: v })}
                      onBlur={() => patch(d.weekday, { openingTime: normalizeTime(d.openingTime) })}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      style={styles.time}
                    />
                    <AppText variant="caption">–</AppText>
                    <TextInput
                      accessibilityLabel={t("schedule.closingFor", { day: name })}
                      value={d.closingTime}
                      onChangeText={(v) => patch(d.weekday, { closingTime: v })}
                      onBlur={() => patch(d.weekday, { closingTime: normalizeTime(d.closingTime) })}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      style={styles.time}
                    />
                  </View>
                )}
                <Switch
                  accessibilityLabel={t("schedule.openOn", { day: name })}
                  value={!d.isClosed}
                  onValueChange={(open) => patch(d.weekday, { isClosed: !open })}
                  trackColor={{ true: colors.accent, false: colors.borderStrong }}
                  thumbColor={colors.white}
                />
              </View>
            );
          })}

        <Button title={t("schedule.save")} loading={saveHours.isPending} disabled={busy} onPress={submitHours} />

        {error ? (
          <View style={{ gap: space.sm }}>
            <Banner tone="danger" title={error} body={conflicts.length > 0 ? t("schedule.conflictTitle") : ""} />
            {conflicts.slice(0, 10).map((c) => (
              <AppText key={`${c.bookingId}-${c.kind}`} variant="caption">
                {`${formatShopDay(c.date)} · ${t(KIND_KEY[c.kind] ?? KIND_KEY.dropoff)} · ${c.guestName ?? "—"}`}
              </AppText>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <CalendarOff size={18} color={colors.ink} />
          <AppText variant="heading">{t("schedule.closuresTitle")}</AppText>
        </View>
        <AppText variant="caption">{t("schedule.closuresHint")}</AppText>

        {schedule.closures.length === 0 ? (
          <AppText variant="caption">{t("schedule.none")}</AppText>
        ) : (
          schedule.closures.map((c) => (
            <View key={c.id} style={styles.closure}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium">{closureLabel(c)}</AppText>
                {c.reason ? <AppText variant="caption">{c.reason}</AppText> : null}
              </View>
              <IconButton label={t("schedule.remove")} onPress={() => !busy && confirmRemove(c)}>
                <Trash2 size={18} color={colors.danger} />
              </IconButton>
            </View>
          ))
        )}

        {adding ? (
          <Card style={{ gap: space.md }}>
            <RangeCalendar
              start={range.start}
              end={range.end}
              maxDays={365}
              onChange={(start, end) => setRange({ start, end })}
            />
            <AppText variant="bodyMedium">
              {cellToIso(range.start) === cellToIso(range.end)
                ? formatShopDay(cellToIso(range.start))
                : `${formatShopDay(cellToIso(range.start))} → ${formatShopDay(cellToIso(range.end))}`}
            </AppText>
            <Field label={t("schedule.reason")} value={reason} onChangeText={setReason} maxLength={200} />
            <Button
              title={t("schedule.add")}
              loading={addClosure.isPending}
              disabled={busy}
              onPress={() => addClosure.mutate()}
            />
            <Button variant="ghost" title={t("common.cancel")} onPress={() => setAdding(false)} />
          </Card>
        ) : (
          <Button variant="secondary" title={t("schedule.addOpen")} disabled={busy} onPress={() => setAdding(true)} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function closureLabel(c: ShopClosure) {
  return c.startDate === c.endDate
    ? formatShopDay(c.startDate)
    : `${formatShopDay(c.startDate)} → ${formatShopDay(c.endDate)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  content: { padding: space.xl, gap: space.md },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  dayRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 56 },
  dayName: { width: 96 },
  times: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.xs },
  time: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ink,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  closure: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
});
