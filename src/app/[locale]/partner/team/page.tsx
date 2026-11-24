import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePartnerPage } from "@/lib/page-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import { listTeam } from "@/services/ShopStaffService";
import PartnerTeamClient from "@/components/partner/PartnerTeamClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shopStaff" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Ekip: yalniz sahip (`manage`). Personel `requirePartnerPage` ile panele doner. */
export default async function PartnerTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ shop?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shopStaff");
  const actor = await requirePartnerPage(locale, "/partner/team");
  const sp = (await searchParams) ?? {};
  const shopParam = typeof sp.shop === "string" ? sp.shop : undefined;
  const { shops, activeShop } = await resolvePartnerShops(actor.id, shopParam, "manage");

  if (!activeShop) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-10">
        <p className="font-bold text-gray-500">{t("noShop")}</p>
      </div>
    );
  }

  const team = await listTeam(activeShop.id);
  return (
    <PartnerTeamClient
      shopId={activeShop.id}
      shopName={activeShop.name}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      members={team.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        since: m.createdAt.toISOString(),
      }))}
      invites={team.invites.map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt.toISOString() }))}
      limit={team.limit}
    />
  );
}
