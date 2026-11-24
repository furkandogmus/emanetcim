import { getTranslations } from "next-intl/server";
import { appLinkHref } from "@/lib/app-stores";
import { qrSvg } from "@/lib/qr-svg";
import BrandMark from "@/components/common/BrandMark";
import PrintButton from "@/components/app-promo/PrintButton";

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

type PosterCopy = {
  appName: string;
  printHint: string;
  print: string;
  slogan: string;
  lead: string;
  scan: string;
  steps: [string, string, string];
};

export type ShopPosterProps = { shopName: string; qr: string; copy: PosterCopy };

/**
 * Esnaf panelindeki afis (`/partner/poster`) ile uygulamadan acilan oturumsuz
 * bag (`/poster?t=`) AYNI afisi cizer; QR kaynagi `afis-<dukkan>`.
 */
export async function loadShopPoster(shop: { id: string; name: string }): Promise<ShopPosterProps> {
  const [t, tCommon, qr] = await Promise.all([
    getTranslations("AppPoster"),
    getTranslations("Common"),
    qrSvg(appLinkHref(`afis-${shop.id}`), { margin: 0 }),
  ]);
  return {
    shopName: shop.name,
    qr,
    copy: {
      appName: tCommon("appName"),
      printHint: t("printHint"),
      print: t("print"),
      slogan: t("slogan"),
      lead: t("lead"),
      scan: t("scan"),
      steps: [t("step1"), t("step2"), t("step3")],
    },
  };
}

export default function ShopPosterView({ shopName, qr, copy }: ShopPosterProps) {
  return (
    <div className="bg-gray-100 py-8 px-4 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="bp-no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{copy.printHint}</p>
        <PrintButton label={copy.print} />
      </div>

      <article
        className="bp-poster mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center justify-between bg-white px-[12%] py-[9%] text-center shadow-xl"
        data-testid="partner-poster"
      >
        <div className="flex items-center gap-3">
          <BrandMark size={56} className="h-14 w-auto" />
          <span className="id-display text-4xl italic text-gray-900">{copy.appName}</span>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="id-display id-accent text-5xl leading-tight">{copy.slogan}</h1>
          <p className="text-xl font-bold text-gray-700">{copy.lead}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div
            className="aspect-square w-[62%] min-w-[180px] [&_svg]:h-full [&_svg]:w-full"
            role="img"
            aria-label={copy.scan}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="id-display text-2xl text-gray-900">{copy.scan}</p>
          <p className="font-mono text-sm text-gray-500">bagajpark.com/app</p>
        </div>

        <ol className="w-full space-y-2 text-left text-lg font-bold text-gray-800">
          {copy.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center id-accent-bg rounded-full text-base font-bold">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <p className="text-sm font-bold text-gray-500">{shopName}</p>
      </article>
    </div>
  );
}
