/**
 * "Bekleyen basvuru" TEK TANIM: hic onaylanmamis, pasif ve rezervasyonsuz dukkan.
 * Web liste, mobil liste, genel bakis sayaci ve istatistik hep bunu kullanir;
 * pasife alinmis canli dukkan basvuru gibi gorunup "Reddet" ile (cascade)
 * silinemesin diye. Reddet de ayni sekilde gecmisi olan dukkani reddeder.
 */
export const PENDING_APPLICATION_WHERE = {
  isActive: false,
  approvedAt: null,
  bookings: { none: {} },
} as const;
