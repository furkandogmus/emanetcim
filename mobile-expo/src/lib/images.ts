import { API_BASE_URL } from "./config";

export const SITE_ORIGIN = API_BASE_URL.replace(/\/api\/mobile$/, "");

/** Mutlak URL ve data URL oldugu gibi; "/uploads/..." gibi goreli yol site kokune baglanir. */
export function resolveImage(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^(https?:|data:)/.test(src)) return src;
  if (src.startsWith("/")) return `${SITE_ORIGIN}${src}`;
  return null;
}

/** Next'in gorsel uc noktasinin kabul ettigi genislikler (imageSizes + deviceSizes). */
const OPTIMIZER_WIDTHS = [128, 256, 384, 640, 828, 1080, 1200, 1920];

/**
 * Kucuk gorunen gorsel icin kucultulmus adres: sunucunun `/_next/image` ucu fotografi
 * istenen genislikte yeniden kodlayip onbellekte tutar. 64 px'lik bir kart kucuk resmi
 * icin 2048 px'lik vitrin fotografi (~500 KB) yerine ~10 KB iner. Data URL'ler
 * (avatar) oldugu gibi kalir; uc reddederse `RemoteImage` asil adrese duser.
 */
export function thumbUrl(src: string | null | undefined, displayWidth: number, pixelRatio = 3): string | null {
  const abs = resolveImage(src);
  if (!abs || abs.startsWith("data:")) return abs;
  const need = Math.ceil(displayWidth * pixelRatio);
  const w = OPTIMIZER_WIDTHS.find((x) => x >= need) ?? OPTIMIZER_WIDTHS[OPTIMIZER_WIDTHS.length - 1];
  // Ayni kokten goreli yol oldugu gibi verilir; mutlak adres uzak kaynak olarak.
  const url = src && src.startsWith("/") ? src : abs;
  return `${SITE_ORIGIN}/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=70`;
}
