"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Phone, MessageCircle, MapPin, Check } from "lucide-react";
import { toast } from "sonner";
import { setPartnerLeadContactedAction } from "@/actions/partner-lead";
import { returnedErrorKey } from "@/lib/action-error";

type Lead = {
  id: string;
  fullName: string;
  phone: string;
  shopName: string | null;
  address: string;
  contacted: boolean;
  createdAt: string;
};

export default function AdminPartnerLeadsClient({ leads, locale }: { leads: Lead[]; locale: string }) {
  const t = useTranslations("Admin");
  const tErr = useTranslations("Errors");
  const [rows, setRows] = useState(leads);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string, contacted: boolean) =>
    startTransition(async () => {
      const res = await setPartnerLeadContactedAction({ id, contacted });
      if (!res.success) {
        toast.error(tErr(returnedErrorKey(res.error) ?? "generic"));
        return;
      }
      setRows((r) => r.map((l) => (l.id === id ? { ...l, contacted } : l)));
    });

  const waiting = rows.filter((l) => !l.contacted).length;

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{t("partnerLeadsEmpty")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">{t("partnerLeadsSummary", { waiting, total: rows.length })}</p>
      <ul className="flex flex-col gap-3">
        {rows.map((l) => (
          <li
            key={l.id}
            className={`rounded-2xl border bg-white p-5 ${l.contacted ? "border-gray-100 opacity-60" : "border-brand-200"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900">
                  {l.fullName}
                  {l.shopName ? <span className="font-bold text-gray-500"> · {l.shopName}</span> : null}
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600">
                  <MapPin size={14} className="mt-0.5 shrink-0" /> {l.address}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(l.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`tel:+90${l.phone}`} className="btn-ui btn-ui-sm btn-ui-secondary">
                  <Phone size={14} /> 0{l.phone}
                </a>
                <a
                  href={`https://wa.me/90${l.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ui btn-ui-sm btn-ui-secondary"
                  aria-label={t("partnerLeadsWhatsapp")}
                >
                  <MessageCircle size={14} />
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(l.id, !l.contacted)}
                  className={`btn-ui btn-ui-sm ${l.contacted ? "btn-ui-ghost" : "btn-ui-primary"}`}
                >
                  <Check size={14} /> {l.contacted ? t("partnerLeadsUndo") : t("partnerLeadsMarkContacted")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
