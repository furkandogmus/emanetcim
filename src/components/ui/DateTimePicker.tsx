"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { DayPicker } from "react-day-picker";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useLocale } from "next-intl";
import {
  ar,
  bg,
  de,
  enUS,
  es,
  faIR,
  fr,
  it,
  ja,
  ko,
  pl,
  ru,
  tr,
  zhCN,
  type Locale as DateFnsLocale,
} from "date-fns/locale";
import { Calendar, Clock } from "lucide-react";
import {
  parseDatetimeLocal,
  toDatetimeLocalValue,
} from "@/lib/datetime-local";
import BottomSheet from "@/components/ui/BottomSheet";
import "react-day-picker/style.css";

const LOCALE_MAP: Record<string, DateFnsLocale> = {
  ar,
  bg,
  de,
  en: enUS,
  es,
  fa: faIR,
  fr,
  it,
  ja,
  ko,
  pl,
  ru,
  tr,
  zh: zhCN,
};

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  testId?: string;
  ariaLabel?: string;
  placeholder?: string;
  minDate?: Date;
  stepMinutes?: number;
  className?: string;
  icon?: ReactNode;
  iconSize?: number;
}

function buildTimeOptions(step: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(
      `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
    );
  }
  return out;
}

export default function DateTimePicker({
  value,
  onChange,
  testId,
  ariaLabel,
  placeholder,
  minDate,
  stepMinutes = 20,
  className,
  icon,
  iconSize = 18,
}: DateTimePickerProps) {
  const locale = useLocale();
  const dfLocale = LOCALE_MAP[locale] ?? enUS;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const DATE_LABELS: Record<string, string> = {
    tr: "Tarih Seç",
    en: "Select Date",
    de: "Datum wählen",
    fr: "Choisir la date",
    es: "Seleccionar fecha",
    ar: "اختيار التاريخ",
    bg: "Избор на дата",
    fa: "انتخاب تاریخ",
    it: "Seleziona data",
    ja: "日付を選択",
    ko: "날짜 선택",
    pl: "Wybierz datę",
    ru: "Выберите дату",
    zh: "选择日期",
  };

  const TIME_LABELS: Record<string, string> = {
    tr: "Saat Seç",
    en: "Select Time",
    de: "Uhrzeit wählen",
    fr: "Choisir l'heure",
  };

  const dateLabel = DATE_LABELS[locale] || DATE_LABELS.en;
  const timeLabel = TIME_LABELS[locale] || TIME_LABELS.en;

  const parsed = useMemo(() => parseDatetimeLocal(value), [value]);
  const timeOptions = useMemo(
    () => buildTimeOptions(stepMinutes),
    [stepMinutes],
  );

  const currentTime = useMemo(() => {
    if (!parsed) return timeOptions[0] ?? "00:00";
    const totalMin = parsed.getHours() * 60 + parsed.getMinutes();
    const snappedMin =
      (Math.round(totalMin / stepMinutes) * stepMinutes) % (24 * 60);
    const h = Math.floor(snappedMin / 60);
    const m = snappedMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [parsed, timeOptions, stepMinutes]);

  const display = useMemo(() => {
    if (!parsed) return placeholder ?? "";
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }, [parsed, locale, placeholder]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const applyDate = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      const base = parsed ?? date;
      const merged = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        base.getHours(),
        base.getMinutes(),
      );
      onChange(toDatetimeLocalValue(merged));
    },
    [onChange, parsed],
  );

  const applyTime = useCallback(
    (time: string) => {
      const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
      const base = parsed ?? new Date();
      const merged = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        hh,
        mm,
      );
      onChange(toDatetimeLocalValue(merged));
    },
    [onChange, parsed],
  );

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      {testId ? (
        <input
          type="datetime-local"
          step={stepMinutes * 60}
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden
          className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
        />
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left bg-transparent outline-none relative rounded-lg focus-visible:ring-2 focus-visible:ring-orange-500/40 transition-colors"
      >
        {icon ?? (
          <Calendar
            size={iconSize}
            className="text-gray-400 shrink-0"
            aria-hidden
          />
        )}
        <span className="flex-1 text-sm font-semibold text-gray-900 min-h-[32px] flex items-center truncate">
          {display || (
            <span className="text-gray-400 font-medium">{placeholder}</span>
          )}
        </span>
      </button>

      {isMobile ? (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={dateLabel}
          snapPoints={[30, 70, 95]}
          initialSnap={1}
          showClose
        >
          <div className="px-2 py-2">
            <DayPicker
              mode="single"
              selected={parsed ?? undefined}
              onSelect={applyDate}
              locale={dfLocale}
              weekStartsOn={1}
              disabled={minDate ? { before: minDate } : undefined}
              defaultMonth={parsed ?? minDate ?? new Date()}
              showOutsideDays
              className="rdp-emanet mx-auto text-sm"
            />
          </div>
          <div className="px-2 pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
              {timeLabel}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 px-1 no-scrollbar">
              {timeOptions.map((t) => {
                const selected = t === currentTime;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyTime(t)}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      selected
                        ? "bg-orange-600 text-white shadow-md"
                        : "bg-gray-50 text-gray-700 border border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-2 pb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-3 rounded-2xl bg-gray-900 text-white text-xs font-black uppercase tracking-wider"
            >
              OK
            </button>
          </div>
        </BottomSheet>
      ) : open ? (
        <div
          role="dialog"
          className="absolute left-0 top-full z-50 mt-2 w-[min(340px,94vw)] rounded-2xl border border-gray-100 bg-white shadow-2xl p-3"
          style={
            {
              "--rdp-accent-color": "#ea580c",
              "--rdp-accent-background-color": "#fff7ed",
              "--rdp-day_button-border-radius": "9999px",
              "--rdp-selected-border": "2px solid #ea580c",
              "--rdp-today-color": "#ea580c",
              "--rdp-day-height": "38px",
              "--rdp-day-width": "38px",
            } as CSSProperties
          }
        >
          <DayPicker
            mode="single"
            selected={parsed ?? undefined}
            onSelect={applyDate}
            locale={dfLocale}
            weekStartsOn={1}
            disabled={minDate ? { before: minDate } : undefined}
            defaultMonth={parsed ?? minDate ?? new Date()}
            showOutsideDays
            className="rdp-emanet mx-auto"
          />
          <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-3">
            <Clock size={16} className="text-gray-400 shrink-0" aria-hidden />
            <select
              value={currentTime}
              onChange={(e) => applyTime(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              aria-label={ariaLabel ? `${ariaLabel} — time` : "time"}
            >
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-700"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
