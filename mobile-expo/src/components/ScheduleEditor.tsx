import { useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { RangeCalendar } from "@/components/Calendar";
import { Field } from "@/components/Field";
import { AppText, Banner, Button, Card, IconButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { cellOf, wallInstant } from "@/lib/time";
import type { PartnerSchedule, ScheduleConflict, ScheduleDay, ShopClosure } from "@/lib/types";
import { notify } from "@/lib/notify";
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
 * Gun bazli saatler, 7/24 ve izinler; esnaf ve yonetici ekrani ayni formu kullanir.
 * `path(query)` uc adresini kurar (esnafta `withShop`, yoneticide `admin/shops/:id`).
 */
export function ScheduleEditor({
  schedule,
  path,
  invalidateKey,
  onOpenBooking,
  hint,
  errorNamespace = "schedule",
  readOnly = false,
}: {
  schedule: PartnerSchedule;
  path: (query?: string) => string;
  invalidateKey: readonly unknown[];
  onOpenBooking: (bookingId: string) => void;
  hint?: string;
  errorNamespace?: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open247, setOpen247] = useState(schedule.open247);
  const [days, setDays] = useState<ScheduleDay[]>(schedule.days);
  // Saat kaydi ve izin kaydi AYRI geri bildirim tasir: izin formu sayfanin dibinde,
  // hata ise yukarida kalinca esnaf "hicbir sey olmadi" sanip tekrar tekrar basiyordu.
  const [hoursFeedback, setHoursFeedback] = useState<Feedback | null>(null);
  const [closureFeedback, setClosureFeedback] = useState<Feedback | null>(null);
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState(() => {
    const today = cellOf(new Date());
    return { start: today, end: today };
  });
  const [reason, setReason] = useState("");

  const patch = (weekday: number, next: Partial<ScheduleDay>) =>
    setDays((cur) => cur.map((d) => (d.weekday === weekday ? { ...d, ...next } : d)));

  const failWith = (set: (f: Feedback | null) => void) => (e: unknown) =>
    set({ error: errorMessage(e, errorNamespace), conflicts: conflictsOf(e) });
  const onDone = () => {
    setHoursFeedback(null);
    setClosureFeedback(null);
    void queryClient.invalidateQueries({ queryKey: invalidateKey });
  };

  const saveHours = useMutation({
    mutationFn: (body: { open247: boolean; days: ScheduleDay[] }) =>
      api(path(), { method: "PUT", body }),
    onSuccess: () => {
      onDone();
      notify(t("schedule.saved"));
    },
    onError: failWith(setHoursFeedback),
  });

  const addClosure = useMutation({
    mutationFn: () =>
      api(path(), {
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
    onError: failWith(setClosureFeedback),
  });

  const removeClosure = useMutation({
    mutationFn: (id: string) =>
      api(path(`closureId=${encodeURIComponent(id)}`), { method: "DELETE" }),
    onSuccess: onDone,
    onError: failWith(setClosureFeedback),
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
      setHoursFeedback({ error: t("schedule.timeInvalid"), conflicts: [] });
      return;
    }
    setClosureFeedback(null);
    saveHours.mutate({ open247, days: normalized });
  }

  function confirmRemove(c: ShopClosure) {
    Alert.alert(t("schedule.removeTitle"), closureLabel(c), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("schedule.remove"), style: "destructive", onPress: () => removeClosure.mutate(c.id) },
    ]);
  }

  const busy = readOnly || saveHours.isPending || addClosure.isPending || removeClosure.isPending;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="caption">{hint ?? t("schedule.hint")}</AppText>

        <Card style={styles.switchRow}>
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="bodyMedium">{t("schedule.open247")}</AppText>
            <AppText variant="caption">{t("schedule.open247Hint")}</AppText>
          </View>
          <Switch
            accessibilityLabel={t("schedule.open247")}
            value={open247}
            disabled={readOnly}
            onValueChange={setOpen247}
            trackColor={{ true: colors.accent, false: colors.borderStrong }}
            thumbColor={colors.white}
          />
        </Card>

        {!open247 ? (
          <View style={styles.dayList}>
          {days.map((d, i) => {
            const name = t(`schedule.days.${d.weekday}`);
            return (
              <View key={d.weekday} style={[styles.dayRow, i > 0 && styles.dayDivider]}>
                {/* 360 dp'de tek satira sigmiyordu: gun adi + anahtar ustte, saatler altta. */}
                <View style={styles.dayHead}>
                  <AppText variant="bodyMedium" style={styles.dayName}>
                    {name}
                  </AppText>
                  {d.isClosed ? (
                    <AppText variant="caption" style={{ flexShrink: 1 }}>
                      {t("schedule.closed")}
                    </AppText>
                  ) : null}
                  <Switch
                    accessibilityLabel={t("schedule.openOn", { day: name })}
                    value={!d.isClosed}
                    disabled={readOnly}
                    onValueChange={(open) => patch(d.weekday, { isClosed: !open })}
                    trackColor={{ true: colors.accent, false: colors.borderStrong }}
                    thumbColor={colors.white}
                  />
                </View>
                {!d.isClosed ? (
                  <View style={styles.times}>
                    <TextInput
                      accessibilityLabel={t("schedule.openingFor", { day: name })}
                      value={d.openingTime}
                      onChangeText={(v) => patch(d.weekday, { openingTime: v })}
                      onBlur={() => patch(d.weekday, { openingTime: normalizeTime(d.openingTime) })}
                      keyboardType="numbers-and-punctuation"
                      editable={!readOnly}
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
                      editable={!readOnly}
                      maxLength={5}
                      style={styles.time}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          </View>
        ) : null}

        <Button title={t("schedule.save")} loading={saveHours.isPending} disabled={busy} onPress={submitHours} />

        <FeedbackBlock feedback={hoursFeedback} onOpen={onOpenBooking} />

        <View style={styles.sectionHead}>
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
              {readOnly ? null : (
                <IconButton label={t("schedule.remove")} onPress={() => !busy && confirmRemove(c)}>
                  <Trash2 size={18} color={colors.danger} />
                </IconButton>
              )}
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
            <FeedbackBlock feedback={closureFeedback} onOpen={onOpenBooking} />
            <Button
              title={t("schedule.add")}
              loading={addClosure.isPending}
              disabled={busy}
              onPress={() => {
                setHoursFeedback(null);
                setClosureFeedback(null);
                addClosure.mutate();
              }}
            />
            <Button variant="ghost" title={t("common.cancel")} onPress={() => setAdding(false)} />
          </Card>
        ) : readOnly ? null : (
          <Button variant="secondary" title={t("schedule.addOpen")} disabled={busy} onPress={() => setAdding(true)} />
        )}
        {/* Izin SILME hatasi form kapaliyken de gorunsun. */}
        {!adding ? <FeedbackBlock feedback={closureFeedback} onOpen={onOpenBooking} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Feedback = { error: string; conflicts: ScheduleConflict[] };

/** Hata + cakisan rezervasyonlar; her satir rezervasyon detayina gider. */
function FeedbackBlock({ feedback, onOpen }: { feedback: Feedback | null; onOpen: (bookingId: string) => void }) {
  const { t } = useTranslation();
  if (!feedback) return null;
  const { error, conflicts } = feedback;
  return (
    <View style={{ gap: space.sm }}>
      <Banner tone="danger" title={error} body={conflicts.length > 0 ? t("schedule.conflictTitle") : ""} />
      {conflicts.slice(0, 10).map((c) => (
        <Pressable
          key={`${c.bookingId}-${c.kind}`}
          accessibilityRole="button"
          onPress={() => onOpen(c.bookingId)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <AppText variant="caption" style={{ color: colors.accent }}>
            {`${formatShopDay(c.date)} · ${t(KIND_KEY[c.kind] ?? KIND_KEY.dropoff)} · ${c.guestName ?? "—"}`}
          </AppText>
        </Pressable>
      ))}
      {conflicts.length > 0 ? <AppText variant="caption">{t("schedule.conflictNext")}</AppText> : null}
    </View>
  );
}

function closureLabel(c: ShopClosure) {
  return c.startDate === c.endDate
    ? formatShopDay(c.startDate)
    : `${formatShopDay(c.startDate)} → ${formatShopDay(c.endDate)}`;
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  // Gunler tek kartta: yedi ayri satir ekranda dagilmasin.
  dayList: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
  },
  dayRow: { gap: space.sm, paddingVertical: space.sm, minHeight: 60 },
  dayHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dayDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  dayName: { flex: 1, flexShrink: 1 },
  times: { flexDirection: "row", alignItems: "center", gap: space.sm },
  time: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontVariant: ["tabular-nums"],
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
