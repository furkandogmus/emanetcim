"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Megaphone, RefreshCw, Send } from "lucide-react";
import { Link } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import {
  previewBroadcastAction,
  sendBroadcastAction,
  sendBroadcastTestAction,
  type BroadcastActionError,
} from "@/actions/admin-broadcast";
import { actionErrorKey } from "@/lib/action-error";
import { formatInstant } from "@/lib/format-datetime";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_BODY_MAX,
  BROADCAST_REASON_MAX,
  BROADCAST_REASON_MIN,
  BROADCAST_TITLE_MAX,
  charCount,
} from "@/lib/broadcast";

type Audience = (typeof BROADCAST_AUDIENCES)[number];

export type AdminBroadcastRowVm = {
  id: string;
  audience: Audience;
  titleTr: string;
  bodyTr: string;
  status: "QUEUED" | "SENDING" | "DONE" | "FAILED";
  targetedDevices: number;
  sent: number;
  failed: number;
  createdAtIso: string;
  createdByName: string;
};

const fieldClass =
  "mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]";

export default function AdminBroadcastClient({ history }: { history: AdminBroadcastRowVm[] }) {
  const t = useTranslations("AdminBroadcast");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const [audience, setAudience] = useState<Audience | null>(null);
  const [preview, setPreview] = useState<{ users: number; devices: number } | "loading" | "failed" | null>(null);
  const [titleTr, setTitleTr] = useState("");
  const [bodyTr, setBodyTr] = useState("");
  const [withEnglish, setWithEnglish] = useState(false);
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!audience) return;
    let live = true;
    previewBroadcastAction(audience)
      .then((r) => {
        if (live) setPreview(r.ok ? { users: r.users, devices: r.devices } : "failed");
      })
      .catch(() => {
        if (live) setPreview("failed");
      });
    return () => {
      live = false;
    };
  }, [audience]);

  const content = {
    titleTr,
    bodyTr,
    titleEn: withEnglish ? titleEn : "",
    bodyEn: withEnglish ? bodyEn : "",
  };
  const contentReady =
    charCount(titleTr.trim()) > 0 &&
    charCount(bodyTr.trim()) > 0 &&
    (!withEnglish || (charCount(titleEn.trim()) > 0 && charCount(bodyEn.trim()) > 0));
  const reasonLen = charCount(reason.trim());
  const canSend =
    audience !== null && contentReady && reasonLen >= BROADCAST_REASON_MIN && reasonLen <= BROADCAST_REASON_MAX;

  const showError = (r: BroadcastActionError) => {
    if (r.error.startsWith("Errors.")) {
      toast.error(tErrors(r.error.replace(/^Errors\./, "") as never));
    } else if (r.error === "too_soon") {
      toast.error(t("error_too_soon", { count: Math.max(1, Math.ceil((r.retryAfterSeconds ?? 60) / 60)) }));
    } else {
      toast.error(t(`error_${r.error}` as never));
    }
  };

  const sendTest = () =>
    startTransition(async () => {
      try {
        const r = await sendBroadcastTestAction(content);
        if (!r.ok) return showError(r);
        if (r.devices === 0) toast.warning(t("testNoDevices"));
        else toast.success(t("testSent", { count: r.devices }));
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });

  const send = () => {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        const r = await sendBroadcastAction({ audience, ...content, reason });
        if (!r.ok) return showError(r);
        toast.success(t("sent", { count: r.devices }));
        setTitleTr("");
        setBodyTr("");
        setTitleEn("");
        setBodyEn("");
        setReason("");
        router.refresh();
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });
  };

  const counter = (v: string, max: number) => (
    <span className={`text-xs ${charCount(v.trim()) > max ? "text-red-600" : "text-gray-400"}`}>
      {charCount(v.trim())}/{max}
    </span>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} />
          <span className="text-xs id-eyebrow">{t("back")}</span>
        </Link>
        <h1 className="flex items-center gap-3 text-4xl id-display tracking-tighter text-gray-900">
          <Megaphone size={28} className="text-orange-600" />
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-gray-600">{t("operationalOnly")}</p>

        <form
          className="id-surface mt-8 flex flex-col gap-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) setConfirmOpen(true);
          }}
        >
          <fieldset>
            <legend className="text-sm font-bold text-gray-700">{t("audienceLabel")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {BROADCAST_AUDIENCES.map((a) => (
                <label
                  key={a}
                  className={`cursor-pointer rounded-full px-4 py-2 text-xs id-eyebrow ${audience === a ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-700"}`}
                >
                  <input
                    type="radio"
                    name="audience"
                    value={a}
                    checked={audience === a}
                    onChange={() => {
                      setAudience(a);
                      setPreview("loading");
                    }}
                    className="sr-only"
                  />
                  {t(`audience_${a}` as never)}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500" aria-live="polite">
              {preview === null
                ? t("pickAudience")
                : preview === "loading"
                  ? t("previewLoading")
                  : preview === "failed"
                    ? t("previewFailed")
                    : t("previewLine", { users: preview.users, devices: preview.devices })}
            </p>
          </fieldset>

          <label className="block text-sm font-bold text-gray-700">
            <span className="flex justify-between">
              {t("titleTr")} {counter(titleTr, BROADCAST_TITLE_MAX)}
            </span>
            <input value={titleTr} onChange={(e) => setTitleTr(e.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm font-bold text-gray-700">
            <span className="flex justify-between">
              {t("bodyTr")} {counter(bodyTr, BROADCAST_BODY_MAX)}
            </span>
            <textarea value={bodyTr} onChange={(e) => setBodyTr(e.target.value)} rows={3} className={fieldClass} />
          </label>

          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <input type="checkbox" checked={withEnglish} onChange={(e) => setWithEnglish(e.target.checked)} />
            {t("englishToggle")}
          </label>
          {withEnglish ? (
            <>
              <p className="-mt-3 text-xs text-gray-500">{t("englishHint")}</p>
              <label className="block text-sm font-bold text-gray-700">
                <span className="flex justify-between">
                  {t("titleEn")} {counter(titleEn, BROADCAST_TITLE_MAX)}
                </span>
                <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={fieldClass} />
              </label>
              <label className="block text-sm font-bold text-gray-700">
                <span className="flex justify-between">
                  {t("bodyEn")} {counter(bodyEn, BROADCAST_BODY_MAX)}
                </span>
                <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={3} className={fieldClass} />
              </label>
            </>
          ) : null}

          <label className="block text-sm font-bold text-gray-700">
            {t("reason")}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={BROADCAST_REASON_MAX}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">
              {t("reasonHint", { min: BROADCAST_REASON_MIN })}
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !contentReady}
              onClick={sendTest}
              className="btn-ui btn-ui-md btn-ui-ghost disabled:opacity-40"
            >
              {t("sendTest")}
            </button>
            <button
              type="submit"
              disabled={busy || !canSend}
              className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-2.5 text-xs id-eyebrow text-white hover:bg-orange-700 disabled:opacity-40"
            >
              <Send size={14} />
              {t("send")}
            </button>
          </div>
        </form>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg id-display text-gray-900">{t("historyTitle")}</h2>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
            >
              <RefreshCw size={12} />
              {t("refresh")}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="id-surface p-8 text-center text-sm text-gray-400">{t("historyEmpty")}</p>
          ) : (
            <ul className="id-surface divide-y divide-gray-100">
              {history.map((b) => (
                <li key={b.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">{b.titleTr}</p>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] id-eyebrow text-gray-600">
                      {t(`status_${b.status}` as never)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{b.bodyTr}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {t(`audience_${b.audience}` as never)} ·{" "}
                    {formatInstant(b.createdAtIso, locale, { dateStyle: "medium", timeStyle: "short" })}
                    {b.createdByName ? ` · ${b.createdByName}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("counts", { sent: b.sent, failed: b.failed, targeted: b.targetedDevices })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("confirmTitle")}
        message={t("confirmBody", {
          audience: audience ? t(`audience_${audience}` as never) : "",
          devices: preview && typeof preview === "object" ? preview.devices : 0,
        })}
        confirmLabel={t("confirmSend")}
        cancelLabel={tCommon("cancel")}
        onConfirm={send}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
