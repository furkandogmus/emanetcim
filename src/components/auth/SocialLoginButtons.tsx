"use client";

import { signIn } from "next-auth/react";
import { LogIn, Apple, ShieldCheck, Store, User } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

const DEMO_PASSWORD =
  typeof process.env.NEXT_PUBLIC_DEMO_PASSWORD === "string" &&
  process.env.NEXT_PUBLIC_DEMO_PASSWORD.length > 0
    ? process.env.NEXT_PUBLIC_DEMO_PASSWORD
    : "Demo123!";

type Props = {
  /** Sunucuda APPLE_ID + APPLE_SECRET tanımlıysa true (ör. üst bileşenden iletin). */
  showAppleSignIn?: boolean;
  /** Dev veya NEXT_PUBLIC_ENABLE_AUTH_DEMO=true */
  showDemoShortcuts?: boolean;
};

/**
 * Sosyal giriş + isteğe bağlı demo kısayolları.
 * Tercih edilen giriş akışı: [LoginClient](@/app/[locale]/login/LoginClient.tsx)
 */
export default function SocialLoginButtons({
  showAppleSignIn = false,
  showDemoShortcuts = false,
}: Props) {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  const handleDemoLogin = (emailOrPhone: string) => {
    signIn("credentials", {
      emailOrPhone,
      password: DEMO_PASSWORD,
      callbackUrl: "/",
      redirect: true,
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => signIn("google")}
          className="w-full bg-white border border-gray-200 text-gray-700 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm"
        >
          <LogIn size={20} className="text-blue-500" />
          {t("continueWithGoogle")}
        </button>

        {showAppleSignIn ? (
          <button
            type="button"
            onClick={() => signIn("apple")}
            className="w-full bg-gray-900 border border-transparent text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-[0.98] shadow-xl"
          >
            <Apple size={20} fill="currentColor" />
            {t("continueWithApple")}
          </button>
        ) : null}
      </div>

      {showDemoShortcuts ? (
        <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={() => setIsDemoOpen(!isDemoOpen)}
            className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] hover:text-orange-600 transition-colors mx-auto"
          >
            {isDemoOpen ? t("demoToggleHide") : t("demoToggleShow")}
          </button>

          {isDemoOpen && (
            <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <button
                type="button"
                onClick={() => handleDemoLogin("admin@bagajpark.com")}
                className="bg-orange-50 hover:bg-orange-100 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group"
              >
                <ShieldCheck size={20} className="text-orange-600" />
                <span className="text-[10px] font-black text-orange-900">
                  {tCommon("demoAdmin")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin("galata@shop.com")}
                className="bg-blue-50 hover:bg-blue-100 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group"
              >
                <Store size={20} className="text-blue-600" />
                <span className="text-[10px] font-black text-blue-900">
                  {tCommon("demoEsnaf")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin("guest@example.com")}
                className="bg-green-50 hover:bg-green-100 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group"
              >
                <User size={20} className="text-green-600" />
                <span className="text-[10px] font-black text-green-900">
                  {tCommon("demoMisafir")}
                </span>
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
