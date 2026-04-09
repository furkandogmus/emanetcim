import prisma from "@/lib/db";
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from "next-intl/server";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
  params: Promise<{ locale: string }>;
}

export default async function VerifyEmailPage({ searchParams, params }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const { locale } = await params;
  const t = await getTranslations("Auth");

  if (!token) {
    return <ErrorState message={t("verifyEmailInvalidToken")} locale={locale} tAuth={t} />;
  }

  // Token'ı bul
  const existingToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!existingToken) {
    return <ErrorState message={t("verifyEmailTokenNotFound")} locale={locale} tAuth={t} />;
  }

  const hasExpired = new Date(existingToken.expires) < new Date();
  if (hasExpired) {
    return <ErrorState message={t("verifyEmailTokenExpired")} locale={locale} tAuth={t} />;
  }

  // Kullanıcıyı bul ve doğrula
  const existingUser = await prisma.user.findUnique({
    where: { email: existingToken.identifier },
  });

  if (!existingUser) {
    return <ErrorState message={t("verifyEmailUserNotFound")} locale={locale} tAuth={t} />;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: existingUser.id },
      data: { emailVerified: new Date(), email: existingToken.identifier },
    }),
    prisma.verificationToken.delete({
      where: { token },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <CheckCircle2 size={32} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">{t("verifyEmailTitle")}</h1>
        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
          {t("verifyEmailSuccess")}
        </p>
        <Link 
          href={`/${locale}/login`}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center"
        >
          {t("verifyEmailGoToLogin")}
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message, locale, tAuth }: { message: string, locale: string, tAuth: any }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <XCircle size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">{tAuth("verifyEmailErrorTitle")}</h1>
        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
          {message}
        </p>
        <Link 
          href={`/${locale}/login`}
          className="w-full h-12 border-2 border-gray-100 rounded-xl font-bold text-sm text-gray-600 hover:border-orange-200 transition-all flex items-center justify-center"
        >
          {tAuth("verifyEmailBackToLogin")}
        </Link>
      </div>
    </div>
  );
}
