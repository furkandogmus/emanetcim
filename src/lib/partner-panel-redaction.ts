import type { PartnerDashboardSnapshot } from "@/services/PartnerDashboardService";

/**
 * Personel paneli (web `/partner`) icin sunucu tarafi ayiklama. Istemci bileseni
 * `canManage=false` ile kazanci CIZMIYOR, ama RSC yukunde deger kalirsa tarayicida
 * okunur. Kazanc, esnaf payi, fiyat ve sahip telefonu bu yuzden sunucuda sifirlanir.
 */
export function redactPulseForStaff<T extends Pick<PartnerDashboardSnapshot, "monthNet" | "prevMonthNet" | "monthChangePct">>(
  pulse: T,
  canManage: boolean,
): T {
  if (canManage) return pulse;
  return { ...pulse, monthNet: 0, prevMonthNet: 0, monthChangePct: null };
}

export type PartnerMoneyProps = {
  totalEarnings: number;
  merchantShareRatio: number;
  initialPricePerDay: number;
  marketPrice: number;
  initialPhone: string;
  commissionActive: boolean;
};

export function redactMoneyPropsForStaff(p: PartnerMoneyProps, canManage: boolean): PartnerMoneyProps {
  if (canManage) return p;
  return { totalEarnings: 0, merchantShareRatio: 0, initialPricePerDay: 0, marketPrice: 0, initialPhone: "", commissionActive: false };
}
