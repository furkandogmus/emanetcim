"use client";

import { useSession } from "next-auth/react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * E-posta doğrulanmamışsa en tepede çıkan uyarı çubuğu.
 */
export default function VerificationBanner() {
  const { data: session } = useSession();
  const t = useTranslations("Common");

  // Kullanıcı giriş yapmamışsa veya zaten doğrulanmışsa hiçbir şey gösterme
  if (!session?.user || session.user.emailVerified) {
    return null;
  }

  return (
    <div className="bg-orange-600 text-white py-3 px-6 fixed top-0 left-0 w-full z-[60] flex items-center justify-center gap-4 animate-in slide-in-from-top duration-500 shadow-lg">
      <AlertCircle size={20} className="shrink-0" />
      <p className="text-xs md:text-sm font-black uppercase tracking-widest text-center">
        {t("emailVerificationRequiredBanner") || "E-posta adresinizi doğrulamanız gerekiyor. Lütfen gelen kutunuzu kontrol edin."}
      </p>
      {/* İleride buraya 'Tekrar Gönder' butonu eklenebilir */}
      <ArrowRight size={18} className="shrink-0 ml-2 animate-pulse" />
    </div>
  );
}
