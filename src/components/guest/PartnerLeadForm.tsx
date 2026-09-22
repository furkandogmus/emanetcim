"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { submitPartnerLeadAction, type PartnerLeadFormState } from "@/actions/partner-lead";
import { returnedErrorKey } from "@/lib/action-error";

const initialState: PartnerLeadFormState = { status: "idle" };

const inputClass =
  "block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 " +
  "placeholder:text-gray-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";

export default function PartnerLeadForm() {
  const t = useTranslations("PartnerSignup");
  const tErr = useTranslations("Errors");
  const [state, formAction, isPending] = useActionState(submitPartnerLeadAction, initialState);
  // Kontrollu alanlar: React 19 action sonrasi formu sifirliyor; hata durumunda esnaf yazdiklarini kaybetmemeli.
  const [values, setValues] = useState({ fullName: "", phone: "", shopName: "", address: "" });
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center" role="status">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={36} />
        </div>
        <div>
          <p className="text-2xl id-display text-gray-900">
            {state.name ? t("successTitleNamed", { name: state.name }) : t("successTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-gray-600">
            {state.alreadyRegistered ? t("successAlready") : t("successBody")}
          </p>
        </div>
        <Link href="/esnaf/nasil-calisir" className="btn-ui btn-ui-lg btn-ui-secondary">
          {t("successCta")}
          <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  const errorKey = state.status === "error" ? returnedErrorKey(state.error) ?? "generic" : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="pl-fullName" className="mb-1.5 block text-sm font-bold text-gray-800">
          {t("fieldName")}
        </label>
        <input
          id="pl-fullName"
          name="fullName"
          type="text"
          required
          minLength={3}
          maxLength={100}
          autoComplete="name"
          value={values.fullName}
          onChange={set("fullName")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="pl-phone" className="mb-1.5 block text-sm font-bold text-gray-800">
          {t("fieldPhone")}
        </label>
        <input
          id="pl-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          maxLength={20}
          autoComplete="tel"
          placeholder="05XX XXX XX XX"
          aria-describedby="pl-phone-hint"
          value={values.phone}
          onChange={set("phone")}
          className={inputClass}
        />
        <p id="pl-phone-hint" className="mt-1.5 text-xs text-gray-500">
          {t("fieldPhoneHint")}
        </p>
      </div>

      <div>
        <label htmlFor="pl-shopName" className="mb-1.5 flex items-baseline justify-between text-sm font-bold text-gray-800">
          {t("fieldShop")}
          <span className="text-xs font-medium text-gray-400">{t("optional")}</span>
        </label>
        <input
          id="pl-shopName"
          name="shopName"
          type="text"
          maxLength={120}
          autoComplete="organization"
          value={values.shopName}
          onChange={set("shopName")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="pl-address" className="mb-1.5 block text-sm font-bold text-gray-800">
          {t("fieldAddress")}
        </label>
        <textarea
          id="pl-address"
          name="address"
          required
          minLength={5}
          maxLength={400}
          rows={2}
          autoComplete="street-address"
          placeholder={t("fieldAddressPlaceholder")}
          value={values.address}
          onChange={set("address")}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Bal kupu: ekranda ve erisilebilirlik agacinda yok; yalnizca botlar doldurur. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="pl-website">Website</label>
        <input id="pl-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {errorKey && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-sm font-bold text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {tErr(errorKey)}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-ui btn-ui-lg btn-ui-primary mt-1 w-full text-base"
      >
        {isPending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {t("submitting")}
          </>
        ) : (
          <>
            {t("submit")}
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <p className="text-center text-xs leading-relaxed text-gray-500">
        {t.rich("consent", {
          link: (chunks) => (
            <Link href="/kvkk" className="underline underline-offset-2 hover:text-gray-700">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
