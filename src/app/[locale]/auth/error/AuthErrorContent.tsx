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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center mb-4 -mt-2">
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
