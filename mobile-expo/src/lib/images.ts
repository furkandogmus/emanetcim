import { API_BASE_URL } from "./config";

const SITE_ORIGIN = API_BASE_URL.replace(/\/api\/mobile$/, "");

/** Mutlak URL ve data URL oldugu gibi; "/uploads/..." gibi goreli yol site kokune baglanir. */
export function resolveImage(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^(https?:|data:)/.test(src)) return src;
  if (src.startsWith("/")) return `${SITE_ORIGIN}${src}`;
  return null;
}
