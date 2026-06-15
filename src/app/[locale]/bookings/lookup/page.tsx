import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import ManageLookupForm from "./ManageLookupForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return { title: t("manageBookingTitle") };
}

export default async function ManageBookingLookupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ManageLookupForm />;
}
