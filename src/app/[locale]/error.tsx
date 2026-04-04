"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-orange-50 p-8 rounded-[3rem] border-2 border-orange-100 flex flex-col items-center gap-6 max-w-sm"
      >
        <div className="bg-orange-600 p-4 rounded-3xl text-white">
          <AlertTriangle size={48} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">{t("errorTitle")}</h1>
          <p className="text-sm text-gray-500 leading-relaxed font-medium">{t("errorDescription")}</p>
        </div>

        <button
          type="button"
          onClick={() => reset()}
          className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-gray-100"
        >
          <RefreshCcw size={20} />
          {t("errorRetry")}
        </button>
      </motion.div>
    </div>
  );
}
