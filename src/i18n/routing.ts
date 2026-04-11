import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: [
    'tr',
    'en',
    'de',
    'fr',
    'es',
    'it',
    'zh',
    'ja',
    'ar',
    'ko',
    'ru',
    'fa',
    'bg',
    'pl',
  ],
  defaultLocale: 'tr',
  localeDetection: false
});

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
