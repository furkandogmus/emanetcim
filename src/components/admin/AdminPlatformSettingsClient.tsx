"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updatePlatformSettingsAction } from "@/actions/admin";

export type PlatformSettingsFormValues = {
  maxStayDays: number;
  maxBagsPerSlot: number;
  insuranceFeeTry: number;
  earlyRefundRatio: number;
  cancelFixedFeeTry: number;
  defaultShopCapacity: number;
  defaultPricePerDay: number;
  bagMultiplierS: number;
  bagMultiplierM: number;
  bagMultiplierXl: number;
  /** YYYY-MM-DD satır veya virgülle */
  holidayDatesRaw: string;
};

function parseHolidayDatesRaw(raw: string): string[] {
  return raw
    .split(/[\n,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
}

function Field({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <input
        type="number"
        step={step}
        className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-900"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

export default function AdminPlatformSettingsClient({
  initial,
  updatedAtLabel,
}: {
  initial: PlatformSettingsFormValues;
  updatedAtLabel: string;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PlatformSettingsFormValues>(initial);

  const patch = (partial: Partial<PlatformSettingsFormValues>) => {
    setForm((f) => ({ ...f, ...partial }));
  };

  const submit = () => {
    startTransition(async () => {
      const platformHolidayDates = parseHolidayDatesRaw(form.holidayDatesRaw);
      const res = await updatePlatformSettingsAction({
        maxStayDays: form.maxStayDays,
        maxBagsPerSlot: form.maxBagsPerSlot,
        insuranceFeeTry: form.insuranceFeeTry,
        earlyRefundRatio: form.earlyRefundRatio,
        cancelFixedFeeTry: form.cancelFixedFeeTry,
        defaultShopCapacity: form.defaultShopCapacity,
        defaultPricePerDay: form.defaultPricePerDay,
        bagMultiplierS: form.bagMultiplierS,
        bagMultiplierM: form.bagMultiplierM,
        bagMultiplierXl: form.bagMultiplierXl,
        platformHolidayDates,
      });
      if (!res.success) {
        toast.error(t("platformSettingsInvalid"));
        return;
      }
      toast.success(t("platformSettingsSaved"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <p className="text-xs font-bold text-gray-500">{t("platformSettingsAuditHint", { at: updatedAtLabel })}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field
          label={t("platformSettingsMaxStayDays")}
          value={form.maxStayDays}
          onChange={(v) => patch({ maxStayDays: Math.round(v) })}
        />
        <Field
          label={t("platformSettingsMaxBagsPerSlot")}
          value={form.maxBagsPerSlot}
          onChange={(v) => patch({ maxBagsPerSlot: Math.round(v) })}
        />
        <Field
          label={t("platformSettingsInsuranceFee")}
          value={form.insuranceFeeTry}
          onChange={(v) => patch({ insuranceFeeTry: v })}
        />
        <Field
          label={t("platformSettingsEarlyRefundRatio")}
          value={form.earlyRefundRatio}
          onChange={(v) => patch({ earlyRefundRatio: v })}
          step="0.0001"
        />
        <Field
          label={t("platformSettingsCancelFee")}
          value={form.cancelFixedFeeTry}
          onChange={(v) => patch({ cancelFixedFeeTry: v })}
        />
        <Field
          label={t("platformSettingsDefaultCapacity")}
          value={form.defaultShopCapacity}
          onChange={(v) => patch({ defaultShopCapacity: Math.round(v) })}
        />
        <Field
          label={t("platformSettingsDefaultPricePerDay")}
          value={form.defaultPricePerDay}
          onChange={(v) => patch({ defaultPricePerDay: v })}
        />
        <Field
          label={t("platformSettingsBagS")}
          value={form.bagMultiplierS}
          onChange={(v) => patch({ bagMultiplierS: v })}
          step="0.0001"
        />
        <Field
          label={t("platformSettingsBagM")}
          value={form.bagMultiplierM}
          onChange={(v) => patch({ bagMultiplierM: v })}
          step="0.0001"
        />
        <Field
          label={t("platformSettingsBagXl")}
          value={form.bagMultiplierXl}
          onChange={(v) => patch({ bagMultiplierXl: v })}
          step="0.0001"
        />
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {t("platformSettingsHolidayDates")}
          </span>
          <textarea
            className="min-h-[100px] rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono text-gray-900"
            value={form.holidayDatesRaw}
            onChange={(e) => patch({ holidayDatesRaw: e.target.value })}
            placeholder="2025-01-01&#10;2025-12-25"
            spellCheck={false}
          />
          <span className="text-[10px] text-gray-400">{t("platformSettingsHolidayDatesHint")}</span>
        </label>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="self-start rounded-2xl bg-gray-900 px-8 py-4 text-sm font-black uppercase tracking-widest text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "…" : t("platformSettingsSave")}
      </button>
    </div>
  );
}
