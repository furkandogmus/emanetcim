import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signedInAuthPageRedirect } from "@/lib/auth-landing";
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

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();

  if (session?.user) {
    const sp = searchParams ? await searchParams : {};
    redirect(signedInAuthPageRedirect(locale, session.user.role, sp.callbackUrl));
  }

  return <RegisterClient />;
}
