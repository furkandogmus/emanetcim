"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { Package, Lock, Loader2 } from "lucide-react";
import { resetPasswordWithTokenAction } from "@/actions/password-reset";

export default function NewPasswordClient() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("invalid_token");
    }
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("invalid_token");
      return;
    }
    if (password !== confirm) {
      setError("mismatch");
      return;
    }
    setBusy(true);
    try {
      const res = await resetPasswordWithTokenAction({
        token,
        password,
        confirmPassword: confirm,
      });
      if (res.ok) {
        setOk(true);
        setTimeout(() => router.replace("/login"), 2000);
        return;
      }
      if (res.error === "rate_limited") setError("rate_limited");
      else if (res.error === "expired") setError("expired");
      else if (res.error === "invalid_token") setError("invalid_token");
      else setError("invalid");
    } finally {
      setBusy(false);
    }
  };

  const errMsg =
    error === "mismatch"
      ? t("newPasswordMismatch")
      : error === "rate_limited"
        ? t("newPasswordRateLimited")
        : error === "expired"
          ? t("newPasswordExpired")
          : error === "invalid_token"
            ? t("newPasswordInvalidToken")
            : error
              ? t("newPasswordInvalid")
              : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="w-full max-w-md rounded-[2.5rem] border border-gray-100 bg-white p-10 shadow-xl shadow-gray-200/50">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 shadow-lg shadow-orange-200">
          <Package size={32} className="text-white" />
        </div>

        <h1 className="mb-2 text-2xl font-black text-gray-900">{t("newPasswordTitle")}</h1>
        <p className="mb-8 text-sm font-medium leading-relaxed text-gray-500">
          {t("newPasswordSubtitle")}
        </p>

        {ok ? (
          <p className="text-center text-sm font-medium text-green-700">{t("newPasswordSuccess")}</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy || !token}
                placeholder={t("newPasswordLabel")}
                className="h-12 w-full rounded-xl border-2 border-gray-100 pl-10 pr-4 text-sm font-medium text-gray-800 placeholder-gray-300 transition focus:border-orange-300 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy || !token}
                placeholder={t("newPasswordConfirm")}
                className="h-12 w-full rounded-xl border-2 border-gray-100 pl-10 pr-4 text-sm font-medium text-gray-800 placeholder-gray-300 transition focus:border-orange-300 focus:outline-none disabled:opacity-50"
              />
            </div>
            {errMsg && <p className="text-center text-xs font-semibold text-red-600">{errMsg}</p>}
            <button
              type="submit"
              disabled={busy || !token}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 text-sm font-bold text-white transition-all hover:bg-orange-700 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("newPasswordSubmitting")}
                </>
              ) : (
                t("newPasswordSubmit")
              )}
            </button>
            <Link
              href="/login"
              className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-orange-600"
            >
              {t("backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
