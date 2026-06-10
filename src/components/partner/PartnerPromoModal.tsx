"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { X, Store, Percent, Sparkles, ArrowRight } from "lucide-react";

export default function PartnerPromoModal() {
  const t = useTranslations("PartnerPromo");
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Show popup after 2 seconds for a smoother UX
    const timer = setTimeout(() => {
      setIsMounted(true);
      const dismissed = localStorage.getItem("bagajpark_partner_promo_dismissed");
      if (!dismissed) {
        setIsOpen(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    localStorage.setItem("bagajpark_partner_promo_dismissed", "true");
    setIsOpen(false);
  };

  if (!isMounted || !isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div 
        className="relative bg-white rounded-[2rem] shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden p-8 md:p-10 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors p-1.5 rounded-full hover:bg-gray-50 cursor-pointer"
          aria-label={t("close")}
        >
          <X size={20} />
        </button>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-bold mb-6 border border-orange-100">
          <Sparkles size={12} className="animate-pulse" />
          <span>{t("badge")}</span>
        </div>

        {/* Content */}
        <div className="flex gap-4 items-start mb-6">
          <div className="w-12 h-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-100">
            <Store size={24} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-snug">
              {t("title")}
            </h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed font-semibold">
              {t("description")}
            </p>
          </div>
        </div>

        {/* Campaign Offer Highlight Box */}
        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-5 mb-8 flex gap-4 items-center">
          <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-amber-100">
            <Percent size={20} className="font-bold" />
          </div>
          <p className="text-sm font-black text-amber-900 leading-relaxed">
            {t("offer")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/register?role=partner"
            onClick={handleClose}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-center py-4 px-6 rounded-2xl font-bold transition-all shadow-lg shadow-orange-200 hover:shadow-orange-300 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>{t("cta")}</span>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <button
            onClick={handleClose}
            className="sm:w-32 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 py-4 px-6 rounded-2xl font-bold transition-all text-center cursor-pointer"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
