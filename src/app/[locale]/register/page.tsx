import { auth } from "@/auth";
import { redirect } from "next/navigation";
import RegisterClient from "./RegisterClient";
import { setRequestLocale } from "next-intl/server";

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
