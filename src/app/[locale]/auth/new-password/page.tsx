import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NewPasswordClient from "./NewPasswordClient";
import { Loader2 } from "lucide-react";
import { resolvePasswordResetLogin } from "@/lib/password-reset-token";
import logger from "@/lib/logger";

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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const accountLogin =
    typeof token === "string"
      ? await resolvePasswordResetLogin(token).catch((err: unknown) => {
          /*
            Form yine calisir (yalnizca sifre yoneticisi ipucu eksik). Hatanin
            kendisi loglanmaz: Prisma mesaji sorgu argumanini, yani token'i icerebilir.
          */
          logger.warn(
            {
              errName: err instanceof Error ? err.name : typeof err,
              errCode: (err as { code?: unknown } | null)?.code,
            },
            "password_reset_login_lookup_failed",
          );
          return null;
        })
      : null;
  return (
    <Suspense fallback={<NewPasswordFallback />}>
      <NewPasswordClient accountLogin={accountLogin} />
    </Suspense>
  );
}
