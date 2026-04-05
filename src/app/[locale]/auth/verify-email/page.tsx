import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { Package, ShieldCheck, Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
  params: Promise<{ locale: string }>;
}

export default async function VerifyEmailPage({ searchParams, params }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const { locale } = await params;

  if (!token) {
    return <ErrorState message="Geçersiz doğrulama linki." locale={locale} />;
  }

  // Token'ı bul
  const existingToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!existingToken) {
    return <ErrorState message="Doğrulama linki bulunamadı veya süresi dolmuş." locale={locale} />;
  }

  const hasExpired = new Date(existingToken.expires) < new Date();
  if (hasExpired) {
    return <ErrorState message="Doğrulama linkinin süresi dolmuş." locale={locale} />;
  }

  // Kullanıcıyı bul ve doğrula
  const existingUser = await prisma.user.findUnique({
    where: { email: existingToken.identifier },
  });

  if (!existingUser) {
    return <ErrorState message="Kullanıcı bulunamadı." locale={locale} />;
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
        <h1 className="text-2xl font-black text-gray-900 mb-4">Başarıyla Doğrulandı!</h1>
        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
          E-posta adresiniz doğrulandı. Artık hesabınıza giriş yapabilir ve valizlerinizi güvenle teslim edebilirsiniz.
        </p>
        <Link 
          href={`/${locale}/login`}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center"
        >
          Giriş Yap
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message, locale }: { message: string, locale: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <XCircle size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">Hata Oluştu</h1>
        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
          {message}
        </p>
        <Link 
          href={`/${locale}/login`}
          className="w-full h-12 border-2 border-gray-100 rounded-xl font-bold text-sm text-gray-600 hover:border-orange-200 transition-all flex items-center justify-center"
        >
          Giriş Sayfasına Dön
        </Link>
      </div>
    </div>
  );
}
