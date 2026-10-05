"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { adminSetUserPasswordAction } from "@/actions/admin-user-account";
import { actionErrorKey } from "@/lib/action-error";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";
import { waMeUrl } from "@/lib/whatsapp";

export type SetPasswordTarget = { userId: string; name: string; phone: string | null };

// Karıştırılabilecek karakterler (0/O, 1/l/I) yok: şifre WhatsApp'tan okunup elle yazılıyor.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export default function AdminSetPasswordDialog({
  target,
  onClose,
}: {
  target: SetPasswordTarget | null;
  onClose: () => void;
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const [password, setPassword] = useState(() => generatePassword());
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setSaved(null);
    setCopied(false);
    setPassword(generatePassword());
    onClose();
  };

  useModalBehavior({ open: target !== null, onClose: close });

  if (!target) return null;

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/tr/login` : "";
  const message = saved
    ? t("setPasswordWhatsappMessage", { name: target.name, password: saved, url: loginUrl })
    : "";
  const whatsapp = saved ? waMeUrl(target.phone, message) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await adminSetUserPasswordAction({ userId: target.userId, password });
        if (!res.ok) {
          toast.error(tErrors(actionErrorKey(new Error(res.error))));
          return;
        }
        setSaved(password);
      } catch (caughtError: unknown) {
        toast.error(tErrors(actionErrorKey(caughtError)));
      }
    });
  };

  const copy = () => {
    navigator.clipboard
      .writeText(message)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error(tCommon("linkCopyFailed")));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-set-password-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="admin-set-password-title" className="text-lg font-black text-gray-900 flex items-center gap-2">
            <KeyRound size={20} className="id-accent" />
            {t("setPasswordTitle")}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={tCommon("close")}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {saved ? (
          <div>
            <p className="text-sm font-medium text-gray-600 mb-4 flex items-center gap-2">
              <Check size={18} className="text-green-600" />
              {t("setPasswordDone")}
            </p>
            <p className="rounded-xl bg-gray-50 border-2 border-gray-100 p-4 text-sm font-medium text-gray-700 whitespace-pre-wrap break-words">
              {message}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {t("setPasswordCopy")}
              </button>
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  <MessageCircle size={16} />
                  {t("partnerCreateSendWhatsapp")}
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-sm font-medium text-gray-600 mb-6">
              {t("setPasswordBody", { name: target.name })}
            </p>
            <label htmlFor="admin-set-password-input" className="id-eyebrow text-gray-400 px-1">
              {t("setPasswordLabel")}
            </label>
            <div className="relative mt-2">
              <input
                id="admin-set-password-input"
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
                className="w-full pr-12 pl-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:border-gray-300"
              />
              <button
                type="button"
                aria-label={t("setPasswordGenerate")}
                title={t("setPasswordGenerate")}
                onClick={() => setPassword(generatePassword())}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={close}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {t("resetCancel")}
              </button>
              <button
                type="submit"
                disabled={pending || password.trim().length < 8}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold id-accent-bg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {pending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {t("setPasswordSubmit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
