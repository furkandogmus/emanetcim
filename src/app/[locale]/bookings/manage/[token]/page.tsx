import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import ManageBookingClient from "@/components/guest/ManageBookingClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return { title: t("manageBookingTitle") };
}

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <ManageBookingClient initialToken={token} />;
}
