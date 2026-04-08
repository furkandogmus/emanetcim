"use client";

import { useSession } from "next-auth/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { resendVerificationAction } from "@/actions/auth-actions";
import { toast } from "sonner";

/**
 * E-posta doğrulanmamışsa en tepede çıkan uyarı çubuğu.
 */
export default function VerificationBanner() {
  const { data: session } = useSession();
  const t = useTranslations("Common");
  const [loading, setLoading] = useState(false);

  // Kullanıcı giriş yapmamışsa, zaten doğrulanmışsa veya YÖNETİCİ ise hiçbir şey gösterme
  if (!session?.user || session.user.emailVerified || session.user.role === "ADMIN") {
    return null;
  }

  const handleResend = async () => {
    setLoading(true);
    try {
      const result = await resendVerificationAction();
      if (result.success) {
        toast.success(t("resendEmailSuccess") || "Doğrulama e-postası tekrar gönderildi.");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t("errorTitle"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-orange-600 text-white py-3 px-6 sticky top-0 left-0 w-full z-[60] flex flex-col sm:flex-row items-center justify-center gap-4 animate-in slide-in-from-top duration-500 shadow-lg border-b border-orange-500">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="shrink-0" />
        <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-center">
          {t("emailVerificationRequiredBanner") || "E-posta adresiniz henüz doğrulanmamış."}
        </p>
      </div>

      <button
        onClick={handleResend}
        disabled={loading}
        className="flex items-center gap-2 bg-white text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {t("resendEmailCta") || "TEKRAR GÖNDER"}
      </button>
    </div>
  );
}
