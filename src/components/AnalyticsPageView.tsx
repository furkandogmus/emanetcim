"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics-client";

/**
 * Birinci taraf sayfa görüntüleme takibi. Next.js App Router'da sayfa
 * geçişleri tam sayfa yenilemesi yapmadığı için her rota değişiminde
 * `usePathname` değişimini izleyip olayı burada gönderiyoruz. Sorgu dizesi
 * bilerek yok sayılıyor — bazen token/hassas parametre taşıyabilir, ve "hangi
 * sayfa" sorusu için path yeterli.
 */
export default function AnalyticsPageView() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
