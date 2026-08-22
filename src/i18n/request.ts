import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

type Messages = Record<string, unknown>;

/**
 * Eksik anahtar EKRANA DÜŞMEZ: her dilin mesajları İngilizce'nin ÜSTÜNE bindirilir.
 *
 * NEDEN (2026-08-22): çeviri borcu olan bir anahtar next-intl'de `MISSING_MESSAGE`
 * olarak loglanıyor ve ekrana HAM ANAHTAR basılıyordu (`Footer.sitemap` canlıda
 * böyle göründü). Borcu sıfırlamak zaman alır; ama borcun kullanıcıya görünmesini
 * bugün engellemek mümkün. Eksik anahtar artık İngilizce metinle gelir —
 * mükemmel değil, ama `CityStorage.istanbul.sections` yerine anlaşılır bir cümle.
 *
 * Borç ölçümü buna bakmaz: `src/locales/locales.test.ts` JSON dosyalarını
 * doğrudan karşılaştırır, yani fallback borcu SAKLAMAZ, yalnızca kullanıcıdan
 * gizler.
 */
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = {...base};
  for (const [key, value] of Object.entries(override)) {
    const prev = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(prev as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (
    !locale ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    locale = routing.defaultLocale;
  }

  const own = (await import(`../locales/${locale}.json`)).default as Messages;
  const messages =
    locale === 'en'
      ? own
      : deepMerge((await import('../locales/en.json')).default as Messages, own);

  return {locale, messages};
});
