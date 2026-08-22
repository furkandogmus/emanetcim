"use client";

import { useEffect } from "react";

/**
 * Eski service worker'ı KALDIRIR (kayıt etmez).
 *
 * 2026-08-23'e kadar `/sw.js` kayıt ediliyordu; dosya next-pwa'nın Turbopack'te
 * hiç çalışmaması yüzünden git'teki eski bir çıktıydı ve yetkili API yanıtlarını
 * önbellekliyordu. Tarayıcıda kurulu kalan SW'ler yeni `sw.js` gelene kadar
 * çalışmaya devam eder; bu yüzden hem burada hem `public/sw.js` içinde temizlik var.
 */
export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => ("caches" in window ? caches.keys() : Promise.resolve([] as string[])))
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {
        /* temizlik en iyi çaba; hata kullanıcıya yansımaz */
      });
  }, []);

  return null;
}
