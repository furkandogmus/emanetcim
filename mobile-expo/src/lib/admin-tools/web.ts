/**
 * Mobilde olmayan yonetim isleri web panelinde; yollar `src/app/[locale]/admin/*` ile ayni.
 * Etiket `admin.web.<bolum>`. Bir is mobile tasininca buradan silinir.
 */
export const ADMIN_WEB_SECTIONS = ["seals", "partners"] as const;

export type AdminWebSection = (typeof ADMIN_WEB_SECTIONS)[number];
