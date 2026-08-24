"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Package, Mail, Loader2, ArrowLeft } from "lucide-react";
import { requestPasswordResetAction } from "@/actions/password-reset";

export default function ForgotPasswordClient() {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestPasswordResetAction(email);
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 font-sans overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(21_95%_60%/.22),transparent)] blur-2xl" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(38_92%_55%/.18),transparent)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-[2.5rem] border border-gray-100 bg-white p-10 shadow-xl shadow-gray-200/50">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-brand-md">
          <Package size={32} className="text-white" />
        </div>

        <h1 className="mb-2 text-2xl font-black text-gray-900">{t("forgotPasswordTitle")}</h1>
        <p className="mb-8 text-sm font-medium leading-relaxed text-gray-500">
          {t("forgotPasswordSubtitle")}
        </p>

        {done ? (
          <div className="space-y-6 text-center">
            <p className="text-sm font-medium leading-relaxed text-gray-600">
              {t("forgotPasswordSuccess")}
            </p>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-orange-600 text-sm font-bold text-white transition-colors hover:bg-orange-700"
            >
              {t("forgotPasswordBackToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
              />
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                aria-label={t("forgotPasswordEmailPlaceholder")}
                placeholder={t("forgotPasswordEmailPlaceholder")}
                className="h-12 w-full rounded-xl border-2 border-gray-100 pl-10 pr-4 text-sm font-medium text-gray-800 placeholder-gray-300 transition focus:border-orange-300 focus:outline-none disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 text-sm font-bold text-white transition-all hover:bg-orange-700 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("forgotPasswordSending")}
                </>
              ) : (
                t("forgotPasswordSubmit")
              )}
            </button>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-orange-600"
            >
              <ArrowLeft size={14} />
              {t("backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
