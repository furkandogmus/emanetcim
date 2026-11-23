"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { applyAffiliateAction, type AffiliateApplyState } from "@/actions/affiliate";
import { returnedErrorKey } from "@/lib/action-error";

const initialState: AffiliateApplyState = { status: "idle" };
const TYPES = ["airbnb_host", "hotel", "guide", "agency", "other"] as const;
const inputClass =
  "block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";
const labelClass = "mb-1.5 block text-sm font-bold text-gray-800";

export default function AffiliateApplyForm() {
  const t = useTranslations("Affiliate");
  const tErr = useTranslations("Errors");
  const [state, formAction, isPending] = useActionState(applyAffiliateAction, initialState);
  const [values, setValues] = useState({ displayName: "", type: "airbnb_host", contactEmail: "", contactPhone: "", applicationNote: "" });
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" role="status">
        <CheckCircle2 size={36} className="text-emerald-600" />
        <p className="text-xl id-display text-gray-900">{t("applySuccessTitle")}</p>
        <p className="text-gray-600">{t("applySuccessBody")}</p>
      </div>
    );
  }
  const errorKey = state.status === "error" ? returnedErrorKey(state.error) ?? "generic" : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="af-name" className={labelClass}>{t("fieldName")}</label>
        <input id="af-name" name="displayName" required minLength={2} maxLength={120} value={values.displayName} onChange={set("displayName")} className={inputClass} />
      </div>
      <div>
        <label htmlFor="af-type" className={labelClass}>{t("fieldType")}</label>
        <select id="af-type" name="type" value={values.type} onChange={set("type")} className={inputClass}>
          {TYPES.map((v) => (
            <option key={v} value={v}>{t(`types.${v}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="af-email" className={labelClass}>{t("fieldEmail")}</label>
        <input id="af-email" name="contactEmail" type="email" maxLength={320} autoComplete="email" value={values.contactEmail} onChange={set("contactEmail")} className={inputClass} />
      </div>
      <div>
        <label htmlFor="af-phone" className={labelClass}>{t("fieldPhone")}</label>
        <input id="af-phone" name="contactPhone" type="tel" maxLength={20} autoComplete="tel" aria-describedby="af-contact-hint" value={values.contactPhone} onChange={set("contactPhone")} className={inputClass} />
        <p id="af-contact-hint" className="mt-1.5 text-xs text-gray-500">{t("fieldContactHint")}</p>
      </div>
      <div>
        <label htmlFor="af-note" className={labelClass}>{t("fieldShare")}</label>
        <textarea id="af-note" name="applicationNote" maxLength={1000} rows={3} placeholder={t("fieldSharePlaceholder")} value={values.applicationNote} onChange={set("applicationNote")} className={`${inputClass} resize-none`} />
      </div>
      {/* Bal kupu: yalnizca botlar doldurur. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="af-website">Website</label>
        <input id="af-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {errorKey ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-sm font-bold text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {tErr(errorKey)}
        </div>
      ) : null}
      <button type="submit" disabled={isPending} className="btn-ui btn-ui-lg btn-ui-primary w-full">
        {isPending ? <Loader2 size={18} className="animate-spin" /> : null}
        {t("applySubmit")}
      </button>
    </form>
  );
}
