import { ApiError } from "@/lib/api";

type SealInput = { sealNumber: string; bagIndex: number; bagSize: "S" | "M" | "XL" };

/** `POST /bookings/:id/check-in` govdesi. `outsideHours` yalnizca esnaf onayladiysa gider. */
export function buildCheckInBody(rows: SealInput[], opts: { outsideHours?: boolean } = {}) {
  const sealAssignments = rows
    .filter((r) => r.sealNumber !== "")
    .map((r) => ({ sealNumber: Number(r.sealNumber), bagIndex: r.bagIndex, bagSize: r.bagSize }));
  return {
    ...(sealAssignments.length ? { sealAssignments, faultySealNumbers: [] } : {}),
    ...(opts.outsideHours ? { outsideHours: true } : {}),
  };
}

/**
 * Saat disi onayi sorulmali mi? Yalnizca ILK denemede: onayli yineleme de
 * `SHOP_CLOSED` donerse (eski sunucu, yetkisiz kullanici) tekrar sormak
 * esnafi sonsuz bir onay dongusune sokar; o zaman hata metni gosterilir.
 */
export function shouldOfferOutsideHours(err: unknown, alreadyConfirmed: boolean): boolean {
  return !alreadyConfirmed && err instanceof ApiError && err.code === "SHOP_CLOSED";
}
