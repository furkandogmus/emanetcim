"use client";

import { useTranslations } from "next-intl";
import { BarChart3, Home, Luggage, Settings } from "lucide-react";

export type PartnerTab = "PANEL" | "TALEPLER" | "GECMIS" | "AYARLAR";

interface PartnerBottomNavProps {
  activeTab: PartnerTab;
  onChange: (tab: PartnerTab) => void;
  /** Onay bekleyen talep sayısı; sıfırdan büyükse kırmızı nokta. */
  pendingCount: number;
}

export default function PartnerBottomNav({ activeTab, onChange, pendingCount }: PartnerBottomNavProps) {
  const t = useTranslations("Partner");
  return (
  <nav className="fixed bottom-3 left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 justify-around gap-2 rounded-[2rem] border border-gray-100 bg-white/90 px-3 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:bottom-8 sm:w-auto sm:gap-8 sm:px-6 sm:py-4">
    <button
      type="button"
      onClick={() => onChange("PANEL")}
      aria-label={t("partnerPanelActive")}
      title={t("partnerPanelActive")}
      className={`p-3 rounded-2xl transition-all ${activeTab === "PANEL" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <Home size={24} />
    </button>
    <button
      type="button"
      onClick={() => onChange("TALEPLER")}
      aria-label={t("incomingRequests")}
      title={t("incomingRequests")}
      className={`p-3 rounded-2xl transition-all relative ${activeTab === "TALEPLER" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <Luggage size={24} />
      {pendingCount > 0 && (
        <span className="absolute top-2 right-2 w-3 h-3 bg-red-600 rounded-full border-2 border-white"></span>
      )}
    </button>
    <button
      type="button"
      onClick={() => onChange("GECMIS")}
      aria-label={t("transactionHistory")}
      title={t("transactionHistory")}
      className={`p-3 rounded-2xl transition-all ${activeTab === "GECMIS" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <BarChart3 size={24} />
    </button>
    <button
      type="button"
      onClick={() => onChange("AYARLAR")}
      aria-label={t("settings")}
      title={t("settings")}
      className={`p-3 rounded-2xl transition-all ${activeTab === "AYARLAR" ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
    >
      <Settings size={24} />
    </button>
  </nav>
  );
}
