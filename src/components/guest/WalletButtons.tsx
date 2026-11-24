import { getTranslations } from "next-intl/server";

type Props = { links: { kind: "apple" | "google"; url: string }[] };

/**
 * Wallet dugmeleri. Apple ve Google'in resmi rozetleri lisans geregi kendi
 * sitelerinden indirilip kosullarla kullaniliyor; depoya girmedi. Metin dugme,
 * iki markanin yonergesindeki siyah zemin + beyaz yazi bicimini izler.
 */
export default async function WalletButtons({ links }: Props) {
  if (links.length === 0) return null;
  const t = await getTranslations("Wallet");
  return (
    <div className="flex flex-col items-center gap-3" data-testid="wallet-buttons">
      <div className="flex flex-wrap justify-center gap-3">
        {links.map((l) => (
          <a
            key={l.kind}
            href={l.url}
            rel="nofollow"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            {l.kind === "apple" ? t("addApple") : t("addGoogle")}
          </a>
        ))}
      </div>
      <p className="text-center text-xs text-gray-500">{t("hint")}</p>
    </div>
  );
}
