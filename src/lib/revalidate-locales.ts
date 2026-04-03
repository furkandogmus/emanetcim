import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";

/**
 * Revalidates a path for every supported locale (e.g. "/bookings" → /tr/bookings, /en/bookings).
 */
export function revalidatePathAllLocales(pathWithoutLocale: string) {
  const normalized = pathWithoutLocale.startsWith("/")
    ? pathWithoutLocale
    : `/${pathWithoutLocale}`;
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}${normalized}`);
  }
}
