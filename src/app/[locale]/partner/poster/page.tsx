import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import { requirePartnerPage } from "@/lib/page-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import { appLinkHref } from "@/lib/app-stores";
import { qrSvg } from "@/lib/qr-svg";
import BrandMark from "@/components/common/BrandMark";
import PrintButton from "@/components/app-promo/PrintButton";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AppPoster" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/*
  Yazdirmada yalnizca afis kalir: kok layout'un ust/alt bilgisi, gezinme ve
  sohbet balonu gizlenir. `visibility` hilesi, afisin hangi sarmalayicinin
  icinde oldugundan bagimsiz calisir.
*/
const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  body * { visibility: hidden !important; }
  .bp-poster, .bp-poster * { visibility: visible !important; }
  .bp-poster { position: absolute; inset: 0; width: 210mm; height: 297mm; margin: 0; box-shadow: none !important; border: 0 !important; }
  .bp-no-print { display: none !important; }
}`;

export default async function PartnerPosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ shop?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AppPoster");
  const tCommon = await getTranslations("Common");
  const actor = await requirePartnerPage(locale, "/partner/poster");
  const sp = (await searchParams) ?? {};

  // Esnaf yalnizca kendi dukkanini gorur (`resolvePartnerShops` sahiplige bakar);
  // yonetici `?shop=` ile herhangi bir dukkanin afisini acabilir.
  const shop =
    actor.role === "ADMIN" && sp.shop
      ? await prisma.shop.findUnique({ where: { id: sp.shop }, select: { id: true, name: true } })
      : (await resolvePartnerShops(actor.id, sp.shop)).activeShop;

  if (!shop) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-10">
        <p className="text-gray-500 font-bold">{t("noShop")}</p>
      </div>
    );
  }

  const qr = await qrSvg(appLinkHref(`afis-${shop.id}`), { margin: 0 });

  return (
    <div className="bg-gray-100 py-8 px-4 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="bp-no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{t("printHint")}</p>
        <PrintButton label={t("print")} />
      </div>

      <article
        className="bp-poster mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center justify-between bg-white px-[12%] py-[9%] text-center shadow-xl"
        data-testid="partner-poster"
      >
        <div className="flex items-center gap-3">
          <BrandMark size={56} className="h-14 w-auto" />
          <span className="id-display text-4xl italic text-gray-900">{tCommon("appName")}</span>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="id-display id-accent text-5xl leading-tight">{t("slogan")}</h1>
          <p className="text-xl font-bold text-gray-700">{t("lead")}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div
            className="aspect-square w-[62%] min-w-[180px] [&_svg]:h-full [&_svg]:w-full"
            role="img"
            aria-label={t("scan")}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="id-display text-2xl text-gray-900">{t("scan")}</p>
          <p className="font-mono text-sm text-gray-500">bagajpark.com/app</p>
        </div>

        <ol className="w-full space-y-2 text-left text-lg font-bold text-gray-800">
          {(["step1", "step2", "step3"] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center id-accent-bg rounded-full text-base font-bold">
                {i + 1}
              </span>
              <span className="pt-0.5">{t(k)}</span>
            </li>
          ))}
        </ol>

        <p className="text-sm font-bold text-gray-500">{shop.name}</p>
      </article>
    </div>
  );
}
