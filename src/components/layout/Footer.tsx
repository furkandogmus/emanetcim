"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ShieldCheck, MapPin, Globe, MessageCircle, Heart } from "lucide-react";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import { useSession } from "next-auth/react";

/**
 * Footer - Kurumsal Bilgi ve Navigasyon Çubuğu
 */
export default function Footer() {
  const t = useTranslations("Footer");
  const tCommon = useTranslations("Common");
  const tCity = useTranslations("CityStorage");
  const locale = useLocale();
  const { data: session } = useSession();
  const hideGuestBookingNav =
    session?.user?.role === "PARTNER" || session?.user?.role === "ADMIN";
  const currentYear = new Date().getFullYear();
  const insuranceLabel = locale === "tr" ? "Sigorta" : "Insurance";

  return (
    <footer className="bg-white border-t border-gray-100 pt-20 pb-10 max-md:pb-28 px-6 font-sans overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-200">
                <ShieldCheck size={20} />
              </div>
              <span className="text-xl font-black tracking-tighter text-gray-900 italic">
                {tCommon("appName")}
              </span>
            </div>
            <p className="text-sm font-bold text-gray-400 mb-8 leading-relaxed">{t("tagline")}</p>
            <div className="flex gap-4">
              <Link
                href="/"
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-all"
                aria-label={t("ariaHome")}
              >
                <Globe size={18} />
              </Link>
              <Link
                href="/contact"
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-all"
                aria-label={t("ariaContact")}
              >
                <MessageCircle size={18} />
              </Link>
              <a
                href="mailto:destek@bagajpark.com"
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-all"
                aria-label={t("ariaEmail")}
              >
                <Heart size={18} />
              </a>
            </div>
            
            <div className="mt-8">
              <a
                href="https://www.producthunt.com/products/bagaj-emanet-ve-valiz-depolama?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-bagaj-emanet-ve-valiz-depolama"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Bagaj Emanet ve Valiz Depolama - Drop Your Bags, Explore Freely | Product Hunt"
                  width="250"
                  height="54"
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1168828&theme=light&t=1781124802196"
                />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-900 mb-6">{t("about")}</h4>
            <ul className="flex flex-col gap-4 text-sm font-bold text-gray-400">
              <li>
                <Link href="/about" className="hover:text-orange-600 transition-colors">
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-orange-600 transition-colors">
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-orange-600 transition-colors">
                  {t("faq")}
                </Link>
              </li>
              <li>
                <Link href="/insurance" className="hover:text-orange-600 transition-colors">
                  {insuranceLabel}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-900 mb-6">{t("corporate")}</h4>
            <ul className="flex flex-col gap-4 text-sm font-bold text-gray-400">
              {!hideGuestBookingNav && (
                <li>
                  <Link href="/partners" className="hover:text-orange-600 transition-colors">
                    {t("becomePartner")}
                  </Link>
                </li>
              )}
              <li>
                <Link href="/terms" className="hover:text-orange-600 transition-colors">
                  {t("terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-orange-600 transition-colors">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/kvkk" className="hover:text-orange-600 transition-colors">
                  {t("kvkk")}
                </Link>
              </li>
              <li>
                <a href="/sitemap.xml" className="hover:text-orange-600 transition-colors">
                  {t("sitemap")}
                </a>
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 p-8 rounded-[2rem] flex flex-col justify-between border border-gray-100">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
                {t("securityProtocol")}
              </h4>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-black text-gray-900">{t("sslProtection")}</span>
              </div>
              <p className="text-[10px] font-bold text-gray-400">{t("paymentsIyzico")}</p>
              <p className="mt-2 text-[10px] font-medium leading-relaxed text-gray-500">
                {t("paymentsNote")}
              </p>
            </div>
            <div className="flex gap-4 mt-6 opacity-30 grayscale contrast-125">
              <div className="w-10 h-6 bg-gray-400 rounded"></div>
              <div className="w-10 h-6 bg-gray-400 rounded"></div>
              <div className="w-10 h-6 bg-gray-400 rounded"></div>
            </div>
          </div>
        </div>

        {!hideGuestBookingNav && (
          <div className="mb-16 pb-16 border-b border-gray-100">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-900">
                {t("citiesTitle")}
              </h4>
              <Link
                href="/luggage-storage"
                className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:underline"
              >
                {t("citiesViewAll")}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {STORAGE_CITIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/luggage-storage/${c.slug}`}
                  className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:border-orange-200 hover:bg-white hover:text-orange-600"
                >
                  {tCity(`${c.slug}.label`)}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="pt-10 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs font-bold text-gray-400">
            © {currentYear} {tCommon("appName")}. {t("rights")}
          </p>
          <div className="flex items-center gap-4 text-[10px] font-black text-gray-300 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {t("location")}
            </span>
            <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
            <span className="flex items-center gap-1 underline underline-offset-4 decoration-orange-200 decoration-2">
              {t("supportHub")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
