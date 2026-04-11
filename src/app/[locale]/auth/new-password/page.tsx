import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NewPasswordClient from "./NewPasswordClient";
import { Loader2 } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return {
    title: t("newPasswordTitle"),
    robots: { index: false, follow: false },
  };
}

function NewPasswordFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Loader2 className="h-10 w-10 animate-spin text-orange-600" aria-hidden />
    </div>
  );
}

export default async function NewPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<NewPasswordFallback />}>
      <NewPasswordClient />
    </Suspense>
  );
}
