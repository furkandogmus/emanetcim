import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import { peekInvite } from "@/services/ShopStaffService";
import StaffInviteAccept from "@/components/partner/StaffInviteAccept";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shopStaff" });
  // Bag anahtar tasir: arama motoruna ve yonlendirene kapali.
  return { title: t("inviteTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * Personel daveti acilis sayfasi. Oturum yoksa giris/kayit, donuste ayni sayfa
 * (`callbackUrl`); oturum varsa kabul dugmesi. Davet yalniz davet edilen e-postanin
 * hesabinda kabul edilir (`ShopStaffService.acceptInvite`).
 */
export default async function StaffInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ t?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shopStaff");
  const sp = (await searchParams) ?? {};
  const token = typeof sp.t === "string" ? sp.t : "";
  const [invite, session] = await Promise.all([peekInvite(token), auth()]);
  const back = `/${locale}/staff-invite?t=${encodeURIComponent(token)}`;

  let body;
  if (!invite || invite.status !== "valid") {
    body = <p className="text-gray-600">{t(invite?.status === "expired" ? "inviteExpired" : "inviteInvalid")}</p>;
  } else if (!session?.user?.id) {
    body = (
      <>
        <p className="text-gray-700">{t("inviteBody", { shop: invite.shopName })}</p>
        <p className="text-sm text-gray-500">{t("inviteSignInHint")}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={{ pathname: "/login", query: { callbackUrl: back } }}
            className="rounded-xl id-accent-bg px-5 py-3 text-sm font-bold hover:opacity-90"
          >
            {t("inviteSignIn")}
          </Link>
          <Link
            href={{ pathname: "/register", query: { callbackUrl: back } }}
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50"
          >
            {t("inviteRegister")}
          </Link>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-gray-700">{t("inviteBody", { shop: invite.shopName })}</p>
        <StaffInviteAccept token={token} />
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl id-display tracking-tight text-gray-900">{t("inviteTitle")}</h1>
      {body}
    </div>
  );
}
