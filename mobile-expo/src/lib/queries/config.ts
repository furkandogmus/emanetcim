import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { CityCoverage, AppConfig } from "../types";

/**
 * Sunucu yapilandirmasi (kimliksiz). Odeme metinleri `paymentMode`a baglanir:
 * kip bilinmiyorsa dukkanda tahsilat (bugun gercek olan) varsayilir, boylece
 * hicbir ekran kartla odeme ya da karta iade vaat etmez.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => api<AppConfig>("/config", { auth: false }),
    staleTime: 10 * 60_000,
  });
}

export function useOnlinePayments(): boolean {
  return useAppConfig().data?.paymentMode === "online";
}

/** Dukkani olan sehirler; yeni sehirde esnaf acilinca kendiliginden gelir. */
export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: () => api<{ cities: CityCoverage[] }>("/cities", { auth: false }).then((r) => r.cities),
    staleTime: 10 * 60_000,
  });
}
