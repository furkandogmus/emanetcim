import { verifyEmailToken, type VerifyEmailErrorCode } from "@/services/auth/verify-email";
import { CheckCircle2, XCircle } from 'lucide-react';
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import AmbientBackdrop from "@/components/common/AmbientBackdrop";

/** Servis kodunun `Auth` sözlüğündeki karşılığı. */
const VERIFY_ERROR_KEY: Record<VerifyEmailErrorCode, string> = {
  INVALID_TOKEN: "verifyEmailInvalidToken",
  TOKEN_NOT_FOUND: "verifyEmailTokenNotFound",
  TOKEN_EXPIRED: "verifyEmailTokenExpired",
  USER_NOT_FOUND: "verifyEmailUserNotFound",
  UNKNOWN: "verifyEmailErrorTitle",
};


interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
  params: Promise<{ locale: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const t = await getTranslations("Auth");

  /*
    Doğrulama kuralı `src/services/auth/verify-email.ts`'te. Bu sayfa ve mobil uç
    2026-08-25'e kadar aynı 35 satırı ayrı ayrı taşıyordu.
  */
  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return <ErrorState message={t(VERIFY_ERROR_KEY[result.code])} tAuth={t} />;
  }

  // Doğrulama bandını gizlemek için layout'u tazele.
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");

  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      <AmbientBackdrop />
      <div className="relative z-10 w-full max-w-md bg-white rounded-4xl p-10 shadow-xl shadow-gray-200/50 border border-gray-100 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <CheckCircle2 size={32} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">{t("verifyEmailTitle")}</h1>
        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
          {t("verifyEmailSuccess")}
        </p>
        <Link
          href="/login"
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center"
        >
          {t("verifyEmailGoToLogin")}
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message, tAuth }: { message: string, tAuth: (key: string) => string }) {
  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      <AmbientBackdrop />
      <div className="relative z-10 w-full max-w-md bg-white rounded-4xl p-10 shadow-xl shadow-gray-200/50 border border-gray-100 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <XCircle size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">{tAuth("verifyEmailErrorTitle")}</h1>
        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
          {message}
        </p>
        <Link
          href="/login"
          className="w-full h-12 border-2 border-gray-100 rounded-xl font-bold text-sm text-gray-600 hover:border-orange-200 transition-all flex items-center justify-center"
        >
          {tAuth("verifyEmailBackToLogin")}
        </Link>
      </div>
    </div>
  );
}
