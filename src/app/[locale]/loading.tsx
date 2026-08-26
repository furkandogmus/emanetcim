"use client";
import { motion } from 'framer-motion';
import { useTranslations } from "next-intl";

export default function Loading() {
   const t = useTranslations("Common");

   return (
    <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-12">
      <div className="relative flex flex-col items-center gap-12 max-w-sm animate-in fade-in duration-500">
        
        {/* Animated Luggage Loader */}
        <div className="relative w-24 h-24">
          <motion.div 
            animate={{ 
              y: [0, -15, 0],
              rotate: [0, -5, 0, 5, 0]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="w-full h-full bg-orange-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-200"
          >
            <div className="w-8 h-2 bg-white/30 rounded-full mb-6"></div>
          </motion.div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-100 rounded-full blur-sm"></div>
        </div>

        <div className="flex flex-col gap-3 text-center">
           <h2 className="text-sm id-eyebrow text-gray-900 animate-pulse">{t("loading")}</h2>
           <div className="h-1 w-48 bg-gray-50 rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-1/2 h-full bg-orange-600 rounded-full"
              />
           </div>
        </div>
      </div>
    </div>
  );
}
