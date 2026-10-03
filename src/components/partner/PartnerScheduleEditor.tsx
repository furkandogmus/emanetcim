"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarOff, Clock, Loader2 } from "lucide-react";
import {
  addClosureAction,
  removeClosureAction,
  saveWeeklyHoursAction,
} from "@/actions/shop-schedule";
import { useActionErrorText } from "@/lib/use-action-error";

type Day = { weekday: number; isClosed: boolean; openingTime: string; closingTime: string };
type Closure = { id: string; startDate: string; endDate: string; reason: string | null };
type Conflict = { bookingId: string; guestName: string | null; date: string; kind: string };

type Props = {
  shopId: string;
  open247: boolean;
  days: Day[];
  closures: Closure[];
};

const KIND_KEY: Record<string, "conflictDropoff" | "conflictPickup" | "conflictBags"> = {
  dropoff: "conflictDropoff",
  pickup: "conflictPickup",
  bags_on_shelf: "conflictBags",
};

export default function PartnerScheduleEditor({ shopId, open247: initial247, days: initialDays, closures }: Props) {
  const t = useTranslations("Partner.schedule");
  const errorText = useActionErrorText();
  const router = useRouter();
  const [open247, setOpen247] = useState(initial247);
  const [days, setDays] = useState(initialDays);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [range, setRange] = useState({ startDate: "", endDate: "", reason: "" });

  const patch = (weekday: number, next: Partial<Day>) =>
    setDays((cur) => cur.map((d) => (d.weekday === weekday ? { ...d, ...next } : d)));

  const run = async (
    fn: () => Promise<{ success: boolean; error?: string; conflicts?: Conflict[] }>,
    onOk?: () => void,
  ) => {
    setBusy(true);
    setError(null);
    setConflicts([]);
    try {
      const res = await fn();
      if (!res.success) {
        setError(errorText(res.error));
        setConflicts(res.conflicts ?? []);
        return;
      }
      onOk?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveHours = () =>
    run(
      () => saveWeeklyHoursAction(shopId, { open247, days }),
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    );

  const addClosure = () =>
    run(
      () => addClosureAction(shopId, range),
      () => setRange({ startDate: "", endDate: "", reason: "" }),
    );

  return (
    <section className="bg-white p-8 rounded-4xl shadow-xl border border-gray-50 flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-black tracking-tight">{t("title")}</h2>
        <p className="ui-body-sm mt-1">{t("hint")}</p>
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={open247}
          onChange={(e) => setOpen247(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="font-bold">{t("open247")}</span>
      </label>
      {open247 ? <p className="ui-body-sm -mt-3">{t("open247Hint")}</p> : null}

      {!open247 && (
        <ul className="flex flex-col gap-3">
          {days.map((d) => {
            const name = t(`days.${d.weekday}`);
            return (
              <li key={d.weekday} className="grid grid-cols-[6rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr_1fr_auto]">
                <span className="font-bold">{name}</span>
                <input
                  type="time"
                  aria-label={`${name} – ${t("dateFrom")}`}
                  value={d.openingTime}
                  disabled={d.isClosed}
                  onChange={(e) => patch(d.weekday, { openingTime: e.target.value })}
                  className="ui-field rounded-2xl text-center disabled:opacity-40"
                />
                <input
                  type="time"
                  aria-label={`${name} – ${t("dateTo")}`}
                  value={d.closingTime}
                  disabled={d.isClosed}
                  onChange={(e) => patch(d.weekday, { closingTime: e.target.value })}
                  className="ui-field rounded-2xl text-center disabled:opacity-40"
                />
                <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
                  <input
                    type="checkbox"
                    checked={d.isClosed}
                    onChange={(e) => patch(d.weekday, { isClosed: e.target.checked })}
                  />
                  {t("closed")}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={saveHours}
        disabled={busy}
        className="ui-btn ui-btn-primary inline-flex items-center justify-center gap-2 rounded-2xl"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
        {t("save")}
      </button>
      {saved ? <p className="ui-state ui-state-success rounded-2xl px-4 py-3">{t("saved")}</p> : null}

      <div className="border-t border-gray-100 pt-6">
        <h3 className="flex items-center gap-2 text-lg font-black">
          <CalendarOff size={18} />
          {t("closuresTitle")}
        </h3>
        <p className="ui-body-sm mt-1">{t("closuresHint")}</p>

        {closures.length === 0 ? (
          <p className="ui-body-sm mt-3">{t("none")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {closures.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                <span className="text-sm font-bold">
                  {c.startDate === c.endDate ? c.startDate : `${c.startDate} → ${c.endDate}`}
                  {c.reason ? <span className="ml-2 font-normal text-gray-500">{c.reason}</span> : null}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => removeClosureAction(shopId, c.id))}
                  className="text-sm font-bold text-red-600 underline"
                >
                  {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t("dateFrom")}
            <input
              type="date"
              value={range.startDate}
              onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value, endDate: r.endDate || e.target.value }))}
              className="ui-field rounded-2xl"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t("dateTo")}
            <input
              type="date"
              value={range.endDate}
              min={range.startDate}
              onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
              className="ui-field rounded-2xl"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
            {t("reason")}
            <input
              type="text"
              maxLength={200}
              value={range.reason}
              onChange={(e) => setRange((r) => ({ ...r, reason: e.target.value }))}
              className="ui-field rounded-2xl"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={addClosure}
          disabled={busy || !range.startDate || !range.endDate}
          className="ui-btn mt-3 rounded-2xl"
        >
          {t("add")}
        </button>
      </div>

      {error ? (
        <div role="alert" className="ui-state ui-state-error rounded-2xl px-4 py-3">
          <p className="font-bold">{error}</p>
          {conflicts.length > 0 ? (
            <>
              <p className="mt-1 text-sm">{t("conflictTitle")}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {conflicts.map((c) => (
                  <li key={`${c.bookingId}-${c.kind}`}>
                    {c.date} · {t(KIND_KEY[c.kind] ?? "conflictDropoff")} · {c.guestName ?? "—"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
