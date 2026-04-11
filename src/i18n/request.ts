import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';
import {deepMergeMessages} from './merge-messages';

const MERGE_LOCALES = new Set([
  'de',
  'fr',
  'es',
  'it',
  'zh',
  'ja',
  'ar'
]);

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (
    !locale ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    locale = routing.defaultLocale;
  }

  if (MERGE_LOCALES.has(locale)) {
    const [baseMod, overlayMod] = await Promise.all([
      import('../locales/en.json'),
      import(`../locales/${locale}.json`)
    ]);
    const messages = deepMergeMessages(
      baseMod.default as Record<string, unknown>,
      overlayMod.default as Record<string, unknown>
    );
    return {locale, messages};
  }

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default
  };
});
