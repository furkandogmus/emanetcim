/**
 * Yonetici ozetinin (`app/(admin)/admin/(tabs)/index.tsx`) baglanti kaydi. Ekran bu
 * listeleri yalnizca cizer; yeni bir arac ekranin kendisine degil buraya girer.
 *
 * - Var olan bolume satir: o bolumun dosyasina (`manage.ts`, `ops.ts`).
 * - Yeni bolum: yeni dosya (ornegin `insights.ts`, bir `AdminToolSection`) ve asagidaki
 *   `ADMIN_TOOL_SECTIONS` dizisine tek satir. Bolumler bu sirayla, "Bekleyenler"in
 *   ardindan ve "Son rezervasyonlar"in onunde cizilir.
 * - Web'e giden bolum: `web.ts`.
 */
import { ADMIN_OPS_TOOLS } from "./ops";
import type { AdminToolSection } from "./types";

export { ADMIN_MANAGE_LINKS } from "./manage";
export { ADMIN_WEB_SECTIONS, type AdminWebSection } from "./web";
export type { AdminToolLink, AdminToolSection } from "./types";

export const ADMIN_TOOL_SECTIONS: readonly AdminToolSection[] = [ADMIN_OPS_TOOLS];
