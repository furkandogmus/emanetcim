"use client";

import { useTranslations } from "next-intl";
import { BarChart3, Home, Settings } from "lucide-react";

/*
  "Talepler" sekmesi kaldirildi: rezervasyonlar APPROVED dogar, onay/red
  bekleyen bir kuyruk yok; sekme bos bir listeyi gosteriyordu.
*/
export type PartnerTab = "PANEL" | "GECMIS" | "AYARLAR";

interface PartnerBottomNavProps {
  activeTab: PartnerTab;
  onChange: (tab: PartnerTab) => void;
}

export default function PartnerBottomNav({ activeTab, onChange }: PartnerBottomNavProps) {
  const t = useTranslations("Partner");
  return (
  <nav className="fixed bottom-3 left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 justify-around gap-2 rounded-3xl border border-gray-100 bg-white/90 px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:bottom-8 sm:w-auto sm:gap-8 sm:px-6 sm:py-3">
    <button
      type="button"
      onClick={() => onChange("PANEL")}
      aria-label={t("partnerPanelActive")}
      title={t("partnerPanelActive")}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${activeTab === "PANEL" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <Home size={22} />
      <span className="text-[9px] font-black uppercase tracking-wider">{t("partnerNavPanel")}</span>
    </button>
    <button
      type="button"
      onClick={() => onChange("GECMIS")}
      aria-label={t("transactionHistory")}
      title={t("transactionHistory")}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${activeTab === "GECMIS" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <BarChart3 size={22} />
      <span className="text-[9px] font-black uppercase tracking-wider">{t("transactionHistory")}</span>
    </button>
    <button
      type="button"
      onClick={() => onChange("AYARLAR")}
      aria-label={t("settings")}
      title={t("settings")}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${activeTab === "AYARLAR" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <Settings size={22} />
      <span className="text-[9px] font-black uppercase tracking-wider">{t("settings")}</span>
    </button>
  </nav>
  );
}
