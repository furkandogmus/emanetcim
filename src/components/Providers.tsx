"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/*
        `reducedMotion="user"`: framer-motion animasyonları işletim sistemindeki
        "hareketi azalt" tercihine UYAR.

        NEDEN GEREKLİ (2026-08-31'de ölçüldü): `globals.css` içinde bir
        `@media (prefers-reduced-motion: reduce)` bloğu VAR ama o blok yalnızca
        CSS animasyon ve geçişlerini durduruyor. framer-motion animasyonları
        JavaScript ile, satır içi `transform` yazarak çalışır — CSS kuralı
        onlara hiç değmez. Yani 18 bileşendeki kayma/ölçek/geçiş animasyonları,
        kullanıcı telefonunda "Hareketi Azalt"ı açmış olsa bile aynen oynuyordu.

        Bu, tercih meselesi değil: vestibüler rahatsızlığı olan kullanıcılarda
        hareket baş dönmesi ve mide bulantısı yapar. iOS ve Android'de bu ayarı
        açan kişi, uygulamanın ona uymasını bekler.

        `"user"` değeri, tercihi olmayan kullanıcı için hiçbir şeyi
        değiştirmiyor — yalnızca açık talebi olan kişiye uyuyor.
      */}
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster richColors position="top-center" />
      </MotionConfig>
    </SessionProvider>
  );
}
