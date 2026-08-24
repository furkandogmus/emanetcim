"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Package, AlertCircle } from "lucide-react";
import { authErrorMessage } from "@/lib/auth-error-message";

export function AuthErrorContent() {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const code = searchParams.get("error");
  const message = authErrorMessage(t, code);

  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(21_95%_60%/.22),transparent)] blur-2xl" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(38_92%_55%/.18),transparent)] blur-2xl" />
        <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
      <div className="relative z-10 w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <div className="w-12 h-12 bg-brand-gradient rounded-xl flex items-center justify-center mb-4 -mt-2 shadow-brand-sm">
          <Package size={24} className="text-white" />
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-2 text-center">
          {t("authErrorTitle")}
        </h1>
        <p className="text-gray-500 text-sm font-medium mb-2 text-center leading-relaxed">
          {message}
        </p>
        {code && (
          <p className="text-[10px] text-gray-400 font-mono mb-6 break-all text-center">
            {code}
          </p>
        )}
        <Link
          href="/login"
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm flex items-center justify-center transition-all"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
