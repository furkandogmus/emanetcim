"use client";

import { useState } from "react";
import { ArrowLeft, Mail, Search, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

type Log = {
  id: string;
  bookingId: string | null;
  type: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  error: string | null;
  createdAt: string;
};

export default function AdminNotificationsClient({
  logs,
  types,
  statuses,
  failedCount,
  filter,
}: {
  logs: Log[];
  types: string[];
  statuses: string[];
  failedCount: number;
  filter: { status: string; type: string; q: string };
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const router = useRouter();
  const dateLocale = bcp47ForUiLocale(locale);

  const [q, setQ] = useState(filter.q);
  const [open, setOpen] = useState<string | null>(null);

  function navigate(next: Partial<{ status: string; type: string; q: string }>) {
    const merged = { ...filter, q, ...next };
    const params = new URLSearchParams();
    if (merged.status !== "ALL") params.set("status", merged.status);
    if (merged.type !== "ALL") params.set("type", merged.type);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    const qs = params.toString();
    router.push(qs ? `/admin/notifications?${qs}` : "/admin/notifications");
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString(dateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={14} />
          {t("backToDashboard")}
        </Link>

        <h1 className="text-3xl id-display text-gray-900 mb-1">
          {t("notificationsTitle")}
        </h1>
        <p className="text-sm text-gray-500 mb-6">{t("notificationsIntro")}</p>

        {failedCount > 0 ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-600" />
            <p className="text-sm text-red-700">
              {t("notificationsFailedBanner", { count: failedCount })}
            </p>
          </div>
        ) : null}

        <form
          className="id-surface p-5 mb-6 grid gap-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({});
          }}
        >
          <div>
            <label
              htmlFor="notification-status"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("status")}
            </label>
            <select
              id="notification-status"
              value={filter.status}
              onChange={(e) => navigate({ status: e.target.value })}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            >
              <option value="ALL">{t("bookingStatusAll")}</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="notification-type"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("notificationsType")}
            </label>
            <select
              id="notification-type"
              value={filter.type}
              onChange={(e) => navigate({ type: e.target.value })}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            >
              <option value="ALL">{t("bookingStatusAll")}</option>
              {types.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="notification-q"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("notificationsRecipient")}
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                id="notification-q"
                type="search"
                aria-label={t("notificationsRecipient")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("notificationsRecipientPlaceholder")}
                className="w-full h-12 pl-11 pr-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
              />
            </div>
          </div>
        </form>

        {logs.length === 0 ? (
          <div className="id-surface p-12 text-center">
            <Mail size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{t("notificationsEmpty")}</p>
          </div>
        ) : (
          <div className="id-surface divide-y divide-gray-100">
            {logs.map((l) => {
              const expanded = open === l.id;
              return (
                <div key={l.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">
                        {l.subject ?? l.type}
                      </p>
                      <p className="text-xs text-gray-400 break-all">
                        {l.recipient} · {fmt(l.createdAt)} · {l.type}
                      </p>
                      {l.error ? (
                        <p className="text-xs text-red-600 mt-1">{l.error}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] id-eyebrow ${
                          l.status === "SENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {l.status}
                      </span>
                      {l.bookingId ? (
                        <Link
                          href={`/admin/bookings/${l.bookingId}`}
                          className="text-xs text-gray-400 hover:text-[color:var(--id-accent)]"
                        >
                          {t("notificationsOpenBooking")}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : l.id)}
                        className="text-xs text-gray-400 hover:text-gray-900 flex items-center gap-1"
                      >
                        {t("notificationsShowBody")}
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>
                  {expanded ? (
                    <pre className="mt-3 p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600 overflow-x-auto whitespace-pre-wrap break-all max-h-80">
                      {l.content}
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
