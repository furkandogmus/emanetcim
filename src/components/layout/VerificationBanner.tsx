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
  const tAuth = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const [isMaxAttempts, setIsMaxAttempts] = useState(false);

  // Kullanıcı giriş yapmamışsa, zaten doğrulanmışsa veya YÖNETİCİ ise hiçbir şey gösterme
  if (!session?.user || session.user.emailVerified || session.user.role === "ADMIN") {
    return null;
  }

  const handleResend = async () => {
    if (cooldown && cooldown > 0) return;
    
    setLoading(true);
    try {
      const result = await resendVerificationAction();
      if (result.success) {
        toast.success(t("resendEmailSuccess"));
        setIsMaxAttempts(false);
        setCooldown(null);
      } else {
        if (result.error === "Errors.verificationCooldown") {
          const wait = result.metadata?.waitSeconds || 0;
          setCooldown(wait);
          toast.error(tErrors("verificationCooldown", { seconds: wait }));
          
          // Geri sayım başlat (basit client-side sync)
          const timer = setInterval(() => {
            setCooldown((prev) => {
              if (prev && prev > 1) return prev - 1;
              clearInterval(timer);
              return null;
            });
          }, 1000);
        } else if (result.error === "Errors.maxVerificationAttempts") {
          setIsMaxAttempts(true);
          toast.error(tErrors("maxVerificationAttempts"));
        } else {
          toast.error(t("errorTitle"));
        }
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
        <div className="flex flex-col">
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-center sm:text-left">
            {t("emailVerificationRequiredBanner")}
          </p>
          {isMaxAttempts && (
            <p className="text-[9px] font-bold text-orange-100 opacity-90">
              {tAuth("contactSupportHelp")}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isMaxAttempts ? (
          <a
            href="mailto:info@bagajpark.com"
            className="flex items-center gap-2 bg-white text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 transition-all shadow-sm"
          >
            {t("contact")}
          </a>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading || (cooldown !== null && cooldown > 0)}
            className="flex items-center gap-2 bg-white text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {cooldown && cooldown > 0 
              ? `${Math.floor(cooldown / 60)}:${(cooldown % 60).toString().padStart(2, '0')}`
              : t("resendEmailCta")
            }
          </button>
        )}
      </div>
    </div>
  );
}
