import type { DisputeStatus } from "@/lib/types";

/**
 * Mevcut bildirimin misafire gorunen sonucu. Eskiden her durumda "ekibimiz
 * inceliyor" yaziyordu, yonetici kapattiktan haftalar sonra bile (bulgu 52).
 * Eski sunucu `disputeStatus` gondermez: o zaman inceleme metni kalir.
 */
export function disputeStatusView(status: DisputeStatus | null | undefined): {
  tone: "success" | "brand";
  key: "dispute.statusText.resolved" | "dispute.statusText.closed" | "dispute.statusText.reviewing";
} {
  if (status === "RESOLVED") return { tone: "success", key: "dispute.statusText.resolved" };
  if (status === "CLOSED") return { tone: "brand", key: "dispute.statusText.closed" };
  return { tone: "success", key: "dispute.statusText.reviewing" };
}
