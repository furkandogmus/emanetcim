import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ChevronLeft } from "lucide-react";
import prisma from "@/lib/db";
import ProfileEditClient from "./ProfileEditClient";

export default async function AccountProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/account/profile`);
  }

  // Dar secim: `image` base64 olabilir, `passwordHash` istemciye hic gitmez (yalnizca var/yok).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, phone: true, email: true, passwordHash: true },
  });
  if (!user) redirect(`/${locale}/login?callbackUrl=/${locale}/account/profile`);

  const t = await getTranslations("AccountProfile");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 font-sans">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-orange-600"
        >
          <ChevronLeft size={18} />
          {t("back")}
        </Link>
        <h1 className="text-3xl id-display tracking-tight text-gray-900">{t("pageTitle")}</h1>
        <p className="mt-2 text-sm text-gray-600">{t("pageIntro")}</p>
        <div className="mt-8">
          <ProfileEditClient
            initialName={user.name ?? ""}
            initialPhone={user.phone ?? ""}
            email={user.email}
            hasPassword={user.passwordHash !== null}
          />
        </div>
      </div>
    </div>
  );
}
