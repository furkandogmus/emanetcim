import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ForgotPasswordClient from "./ForgotPasswordClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return {
    title: t("forgotPasswordTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ForgotPasswordClient />;
}
