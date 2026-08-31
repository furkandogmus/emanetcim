import { auth } from "@/auth";
import { redirect } from "next/navigation";
import RegisterClient from "./RegisterClient";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { socialMetadata } from "@/lib/social-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "register");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/register"),
    ...socialMetadata({
      url: `${base}/${locale}/register`,
      title,
      description,
    }),
  };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();

  if (session?.user) {
    if (session.user.role === 'ADMIN') redirect(`/${locale}/admin`);
    if (session.user.role === 'PARTNER') redirect(`/${locale}/partner`);
    redirect(`/${locale}/search`);
  }

  return <RegisterClient />;
}
