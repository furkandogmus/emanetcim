import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

/**
 * Desteklenen diller — 14'ten 6'ya (2026-08-22).
 *
 * Search Console (son dönem): TR 197 tıklama, UK 12, US 9, GR 9, DE 8, NL 4,
 * SE 3, FR 2, JP 2, IR. Yunan/Hollandalı/İsveçli ziyaretçi İngilizce okur.
 * Kaldırılan 8 dil (es, it, zh, ar, ko, ru, bg, pl) için hiç etkileşim yoktu;
 * buna karşılık 1 MB çeviri, 106 anahtarlık borç ve hiç denetlenmemiş çeviri
 * kalitesi taşıyorduk. Dosyalar git tarihçesinde; talep gelirse geri alınır
 * (`git log -- src/locales/ru.json`).
 */
export const routing = defineRouting({
  locales: [
    'tr',
    'en',
    'de',
    'fr',
    'ja',
    'fa',
  ],
  defaultLocale: 'tr',
  localeDetection: false
});

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
