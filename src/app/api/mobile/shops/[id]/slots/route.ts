import { NextRequest } from "next/server";
import { handleSlotAvailability } from "@/lib/slot-availability-route";

/**
 * Mobil slot müsaitliği. Gövde web ucuyla ORTAK.
 *
 * Buradaki yetki bloğu 2026-08-25'e kadar ÖLÜ koddu: `requireMobileUser`
 * fırlatmaz, döndürür — `try/catch` hiç çalışmıyordu ve uç fiilen açıktı.
 * Slot müsaitliği zaten herkese açık veri (web ucu de istemiyor), o yüzden ölü
 * kod kaldırıldı; davranış değişmedi, yanlış güvence kalktı.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleSlotAvailability(req, params);
}
