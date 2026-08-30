"use client";

import { useState } from "react";
import { ArrowLeft, ShieldCheck, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

type Entry = {
  id: string;
  action: string;
  actorRole: string;
  actorUserId: string | null;
  actorLabel: string | null;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  metadata: string | null;
  createdAt: string;
};

export default function AdminAuditLogClient({
  entries,
  actions,
  entityTypes,
  filter,
}: {
  entries: Entry[];
  actions: string[];
  entityTypes: string[];
  filter: { action: string; entityType: string; q: string };
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const router = useRouter();
  const dateLocale = bcp47ForUiLocale(locale);

  const [q, setQ] = useState(filter.q);
  const [open, setOpen] = useState<string | null>(null);

  function navigate(next: Partial<{ action: string; entityType: string; q: string }>) {
    const merged = { ...filter, q, ...next };
    const params = new URLSearchParams();
    if (merged.action !== "ALL") params.set("action", merged.action);
    if (merged.entityType !== "ALL") params.set("entityType", merged.entityType);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    const qs = params.toString();
    router.push(qs ? `/admin/audit-log?${qs}` : "/admin/audit-log");
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString(dateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={14} />
          {t("backToDashboard")}
        </Link>

        <h1 className="text-3xl id-display text-gray-900 mb-1">
          {t("auditLogTitle")}
        </h1>
        <p className="text-sm text-gray-500 mb-8">{t("auditLogIntro")}</p>

        <form
          className="id-surface p-5 mb-6 grid gap-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({});
          }}
        >
          <div>
            <label htmlFor="audit-action" className="block text-xs id-eyebrow text-gray-500 mb-2">
              {t("auditLogAction")}
            </label>
            <select
              id="audit-action"
              value={filter.action}
              onChange={(e) => navigate({ action: e.target.value })}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            >
              <option value="ALL">{t("bookingStatusAll")}</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-entity" className="block text-xs id-eyebrow text-gray-500 mb-2">
              {t("auditLogEntity")}
            </label>
            <select
              id="audit-entity"
              value={filter.entityType}
              onChange={(e) => navigate({ entityType: e.target.value })}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            >
              <option value="ALL">{t("bookingStatusAll")}</option>
              {entityTypes.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-q" className="block text-xs id-eyebrow text-gray-500 mb-2">
              {t("auditLogSearchLabel")}
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                id="audit-q"
                type="search"
                aria-label={t("auditLogSearchLabel")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("auditLogSearchPlaceholder")}
                className="w-full h-12 pl-11 pr-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
              />
            </div>
          </div>
        </form>

        {entries.length === 0 ? (
          <div className="id-surface p-12 text-center">
            <ShieldCheck size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{t("auditLogEmpty")}</p>
          </div>
        ) : (
          <div className="id-surface divide-y divide-gray-100">
            {entries.map((e) => {
              const expanded = open === e.id;
              return (
                <div key={e.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{e.action}</p>
                      <p className="text-xs text-gray-400">
                        {fmt(e.createdAt)} · {t(`userRole_${e.actorRole}`)}
                        {e.actorLabel ? ` · ${e.actorLabel}` : ""}
                        {e.ip ? ` · ${e.ip}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {e.entityType ? (
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] id-eyebrow">
                          {e.entityType}
                          {e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}
                        </span>
                      ) : null}
                      {e.metadata ? (
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : e.id)}
                          className="text-xs text-gray-400 hover:text-gray-900 flex items-center gap-1"
                        >
                          {t("viewRawData")}
                          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {expanded && e.metadata ? (
                    <pre className="mt-3 p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600 overflow-x-auto">
                      {e.metadata}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
