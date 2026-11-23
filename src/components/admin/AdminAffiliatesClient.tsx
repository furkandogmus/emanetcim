"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Download, Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatDecimal } from "@/lib/currency";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";
import Money from "@/components/common/Money";
import {
  createAffiliateAction,
  markAffiliateCommissionsPaidAction,
  updateAffiliateAction,
} from "@/actions/affiliate";
import { actionErrorKey } from "@/lib/action-error";
import type { toMobileAdminAffiliate } from "@/lib/mobile-dto";

type Affiliate = ReturnType<typeof toMobileAdminAffiliate>;

const TYPES = ["airbnb_host", "hotel", "guide", "agency", "other"] as const;
const STATUSES = ["pending", "active", "paused"] as const;
const ERROR_KEYS = new Set(["invalid_data", "invalid_code", "duplicate_code", "not_found", "user_not_found", "user_already_linked"]);

type Form = {
  displayName: string;
  type: (typeof TYPES)[number];
  code: string;
  contactEmail: string;
  contactPhone: string;
  commissionRate: string;
  guestDiscountRate: string;
  status: (typeof STATUSES)[number];
  notes: string;
  linkedUserEmail: string;
};

const EMPTY: Form = {
  displayName: "",
  type: "airbnb_host",
  code: "",
  contactEmail: "",
  contactPhone: "",
  commissionRate: "10",
  guestDiscountRate: "0",
  status: "active",
  notes: "",
  linkedUserEmail: "",
};

function toForm(a: Affiliate): Form {
  return {
    displayName: a.displayName,
    type: a.type as Form["type"],
    code: a.code,
    contactEmail: a.contactEmail ?? "",
    contactPhone: a.contactPhone ?? "",
    commissionRate: String(a.commissionRate),
    guestDiscountRate: String(a.guestDiscountRate),
    status: a.status as Form["status"],
    notes: a.notes ?? "",
    linkedUserEmail: a.linkedUserEmail ?? "",
  };
}

const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900";
const labelClass = "block text-xs id-eyebrow text-gray-500 mb-1";

export default function AdminAffiliatesClient({ affiliates }: { affiliates: Affiliate[] }) {
  const t = useTranslations("AdminAffiliates");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [reference, setReference] = useState("");
  const [payoutAffiliate, setPayoutAffiliate] = useState("");

  function errorText(code: string) {
    return ERROR_KEYS.has(code) ? t(`errors.${code}` as never) : tErrors("generic");
  }

  function run<R extends { success: boolean; error?: string }>(task: () => Promise<R>, ok: string | ((r: R) => string)) {
    startTransition(async () => {
      try {
        const res = await task();
        if (!res.success) {
          toast.error(errorText("error" in res && res.error ? res.error : "generic"));
          return;
        }
        toast.success(typeof ok === "string" ? ok : ok(res));
        router.refresh();
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });
  }

  function payload(f: Form) {
    return {
      ...f,
      commissionRate: Number(f.commissionRate),
      guestDiscountRate: Number(f.guestDiscountRate),
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={14} />
          {t("back")}
        </Link>
        <h1 className="text-3xl id-display text-gray-900 mb-1">{t("title")}</h1>
        <p className="text-sm text-gray-500 mb-8">{t("intro")}</p>

        <section className="id-surface p-6 mb-8">
          <h2 className="text-lg id-display text-gray-900 mb-4">{t("payoutTitle")}</h2>
          <form
            className="grid gap-4 md:grid-cols-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  markAffiliateCommissionsPaidAction({
                    month,
                    reference,
                    ...(payoutAffiliate ? { affiliateId: payoutAffiliate } : {}),
                  }),
                (r) => (r.success ? t("payoutDone", { count: r.count, total: formatDecimal(r.total, locale, 2) }) : t("saved")),
              );
            }}
          >
            <div>
              <label htmlFor="aff-pay-month" className={labelClass}>{t("payoutMonth")}</label>
              <input id="aff-pay-month" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="aff-pay-affiliate" className={labelClass}>{t("payoutAffiliate")}</label>
              <select id="aff-pay-affiliate" value={payoutAffiliate} onChange={(e) => setPayoutAffiliate(e.target.value)} className={inputClass}>
                <option value="">{t("payoutAll")}</option>
                {affiliates.map((a) => (
                  <option key={a.id} value={a.id}>{a.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="aff-pay-ref" className={labelClass}>{t("payoutReference")}</label>
              <input id="aff-pay-ref" required minLength={2} maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn-ui btn-ui-primary flex-1">
                {pending ? <Loader2 size={16} className="animate-spin" /> : null}
                {t("payoutSubmit")}
              </button>
              <a
                href={`/api/admin/affiliates/commissions?month=${encodeURIComponent(month)}`}
                className="btn-ui btn-ui-secondary"
                aria-label={t("csv")}
                title={t("csv")}
              >
                <Download size={16} />
              </a>
            </div>
          </form>
        </section>

        <section className="id-surface p-6 mb-8">
          <h2 className="text-lg id-display text-gray-900 mb-4">{t("createTitle")}</h2>
          <AffiliateFormFields idPrefix="aff-new" form={form} onChange={setForm} />
          <button
            type="button"
            disabled={pending || form.displayName.trim().length < 2}
            className="btn-ui btn-ui-primary mt-4"
            onClick={() =>
              run(async () => {
                const r = await createAffiliateAction(payload(form));
                if (r.success) setForm(EMPTY);
                return r;
              }, t("created"))
            }
          >
            <Plus size={16} />
            {t("createSubmit")}
          </button>
        </section>

        {affiliates.length === 0 ? <p className="text-sm text-gray-500">{t("empty")}</p> : null}
        <ul className="flex flex-col gap-4">
          {affiliates.map((a) => (
            <li key={a.id} className="id-surface p-5" data-testid={`affiliate-${a.code}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="id-display text-gray-900">
                    {a.displayName} <span className="font-mono text-sm text-gray-500">{a.code}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {t(`types.${a.type}` as never)} · {t(`statuses.${a.status}` as never)} · {t("rates", { commission: a.commissionRate, discount: a.guestDiscountRate })}
                  </p>
                  {a.applicationNote ? <p className="mt-1 text-xs text-gray-600">{a.applicationNote}</p> : null}
                </div>
                <div className="flex gap-2">
                  {a.status === "pending" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="btn-ui btn-ui-primary"
                      onClick={() => run(() => updateAffiliateAction(a.id, { ...payload(toForm(a)), status: "active" }), t("approved"))}
                    >
                      {t("approve")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-ui btn-ui-secondary"
                    onClick={() => {
                      setEditing(editing === a.id ? null : a.id);
                      setEditForm(toForm(a));
                    }}
                  >
                    {t("edit")}
                  </button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <Stat label={t("stats.clicks")} value={a.stats.clicks} />
                <Stat label={t("stats.bookings")} value={a.stats.bookings} />
                <Stat label={t("stats.completed")} value={a.stats.completedBookings} />
                <Stat label={t("stats.earned")} value={<Money amount={a.stats.earned} />} />
                <Stat label={t("stats.unpaid")} value={<Money amount={a.stats.unpaid} />} />
                <Stat label={t("stats.paid")} value={<Money amount={a.stats.paid} />} />
              </dl>
              {editing === a.id ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <AffiliateFormFields idPrefix={`aff-${a.id}`} form={editForm} onChange={setEditForm} withNotes />
                  <button
                    type="button"
                    disabled={pending}
                    className="btn-ui btn-ui-primary mt-4"
                    onClick={() => run(() => updateAffiliateAction(a.id, payload(editForm)), t("saved"))}
                  >
                    {t("save")}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 p-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="id-display text-gray-900">{value}</dd>
    </div>
  );
}

function AffiliateFormFields({
  idPrefix,
  form,
  onChange,
  withNotes = false,
}: {
  idPrefix: string;
  form: Form;
  onChange: (f: Form) => void;
  withNotes?: boolean;
}) {
  const t = useTranslations("AdminAffiliates");
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [k]: e.target.value });
  const text = (k: keyof Form, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`${idPrefix}-${k}`} className={labelClass}>{label}</label>
      <input id={`${idPrefix}-${k}`} value={form[k]} onChange={set(k)} className={inputClass} {...extra} />
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {text("displayName", t("fields.displayName"), { maxLength: 120 })}
      {text("code", t("fields.code"), { maxLength: 32, placeholder: t("fields.codePlaceholder"), className: `${inputClass} font-mono uppercase` })}
      <div>
        <label htmlFor={`${idPrefix}-type`} className={labelClass}>{t("fields.type")}</label>
        <select id={`${idPrefix}-type`} value={form.type} onChange={set("type")} className={inputClass}>
          {TYPES.map((v) => (
            <option key={v} value={v}>{t(`types.${v}` as never)}</option>
          ))}
        </select>
      </div>
      {text("contactEmail", t("fields.contactEmail"), { type: "email", maxLength: 320 })}
      {text("contactPhone", t("fields.contactPhone"), { type: "tel", maxLength: 20 })}
      {text("linkedUserEmail", t("fields.linkedUserEmail"), { type: "email", maxLength: 320 })}
      {text("commissionRate", t("fields.commissionRate"), { type: "number", min: 0, max: 50, step: "0.5" })}
      {text("guestDiscountRate", t("fields.guestDiscountRate"), { type: "number", min: 0, max: 50, step: "0.5" })}
      <div>
        <label htmlFor={`${idPrefix}-status`} className={labelClass}>{t("fields.status")}</label>
        <select id={`${idPrefix}-status`} value={form.status} onChange={set("status")} className={inputClass}>
          {STATUSES.map((v) => (
            <option key={v} value={v}>{t(`statuses.${v}` as never)}</option>
          ))}
        </select>
      </div>
      {withNotes ? (
        <div className="md:col-span-3">
          <label htmlFor={`${idPrefix}-notes`} className={labelClass}>{t("fields.notes")}</label>
          <textarea id={`${idPrefix}-notes`} value={form.notes} onChange={set("notes")} maxLength={1000} rows={2} className={inputClass} />
        </div>
      ) : null}
    </div>
  );
}
