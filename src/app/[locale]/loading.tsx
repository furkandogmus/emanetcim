"use client";
import { motion } from 'framer-motion';
import { useTranslations } from "next-intl";

export default function Loading() {
   const t = useTranslations("Common");

   return (
    <>
    {/*
      AKISTA YER TUTAN BOSLUK -- GORUNMEZ AMA CLS'IN TAMAMINI O COZUYOR.

      Asagidaki yukleme ekrani `fixed`, yani akis disinda: icerik askidayken
      `<main>` SIFIR YUKSEKLIKTE kaliyordu. Yerlesim
      `body.min-h-screen.flex-col > Header > main.flex-1 > Footer` oldugu icin
      footer ekranin ust yarisina cikiyor, icerik akip gelince asagi duşuyordu.

      Uretimde olculdu (Lighthouse 12, masaustu, 2026-09-01):

        cumulative-layout-shift  0.769
        suclu  footer.bg-white   skor 0.769   <- CLS'in tamami
               header > div.flex skor 0.0019

      Footer y=227'den y=3634'e atliyordu; mesafe gorunur alanin katbekat
      uzerinde oldugu icin katki 1.0'a sabitleniyor ve performans skoru 25
      puanlik CLS agirligindan 1 puan aliyordu.

      Bu bosluk askı halinde `main`i bir ekran boyu yapiyor, boylece footer
      DAHA ILK KAREDE katlanin altinda kaliyor. Gorunur alan disindaki
      kaymalar CLS'e girmez -- yani hareket ortadan kalkmiyor, gorunur
      alandan cikiyor. Yuklenmis sayfada bu dosya hic render edilmedigi icin
      etkisi sifir.
    */}
    <div className="min-h-screen" aria-hidden="true" />
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
    </>
  );
}
