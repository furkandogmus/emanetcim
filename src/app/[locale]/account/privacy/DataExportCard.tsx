"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, Mail } from "lucide-react";
import { formatInstant } from "@/lib/format-datetime";

type EmailState = { kind: "sent"; email: string } | { kind: "error"; message: string } | null;

/** KVKK dışa aktarma: her rol indirir ya da doğrulanmış adresine e-postayla ister (mobil ile aynı servis). */
export default function DataExportCard({ fileStem }: { fileStem: string }) {
  const t = useTranslations("AccountDataExport");
  const locale = useLocale();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [emailState, setEmailState] = useState<EmailState>(null);

  // Fetch + blob: hata sayfadan cikmadan cevrilmis metinle gosterilir (2026-09-10).
  const download = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const res = await fetch("/api/account/data-export");
      if (!res.ok) {
        setDownloadError(res.status === 429 ? t("errors.tooManyDownloads") : t("errors.generic"));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `bagajpark-data-${fileStem}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(t("errors.generic"));
    } finally {
      setDownloading(false);
    }
  };

  const email = async () => {
    setEmailState(null);
    setEmailing(true);
    try {
      const res = await fetch("/api/account/data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const body = (await res.json().catch(() => ({}))) as { email?: string; error?: string; retryAt?: string };
      if (res.ok && body.email) {
        setEmailState({ kind: "sent", email: body.email });
        return;
      }
      const message =
        body.error === "rate_limited" && body.retryAt
          ? t("errors.rateLimited", { time: formatInstant(body.retryAt, locale, { dateStyle: "medium", timeStyle: "short" }) })
          : body.error === "no_verified_email"
            ? t("errors.noVerifiedEmail")
            : body.error === "mail_failed"
              ? t("errors.mailFailed")
              : t("errors.generic");
      setEmailState({ kind: "error", message });
    } catch {
      setEmailState({ kind: "error", message: t("errors.generic") });
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
        <Download size={20} className="text-gray-400" aria-hidden />
        {t("title")}
      </h2>
      <p className="mt-2 text-sm text-gray-600">{t("desc")}</p>
      {downloadError ? <p className="mt-2 text-sm font-bold text-red-700">{downloadError}</p> : null}
      {emailState ? (
        <p
          role="status"
          className={`mt-2 text-sm font-bold ${emailState.kind === "sent" ? "text-green-700" : "text-red-700"}`}
        >
          {emailState.kind === "sent" ? t("emailSent", { email: emailState.email }) : emailState.message}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={downloading}
          onClick={() => void download()}
          className="rounded-full border border-gray-200 px-6 py-3 text-xs id-eyebrow text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          {downloading ? "…" : t("downloadButton")}
        </button>
        <button
          type="button"
          disabled={emailing}
          onClick={() => void email()}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-xs id-eyebrow text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          <Mail size={14} aria-hidden />
          {emailing ? "…" : t("emailButton")}
        </button>
      </div>
      <p className="mt-3 text-xs text-gray-500">{t("emailNote")}</p>
    </div>
  );
}
