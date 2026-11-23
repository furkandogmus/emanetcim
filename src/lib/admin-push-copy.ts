/**
 * Yoneticilere giden mobil push metinleri (2026-11-23). Yonetici olaylari (sikayet,
 * esnaf basvurusu, esnaf on kaydi, araci basvurusu) eskiden yalnizca e-posta (+SMS)
 * ile geliyordu; uygulamadaki yonetici telefondan habersiz kaliyordu.
 *
 * Yonetim masasi Turkce/Ingilizce: cihaz dili `tr` ise Turkce, degilse Ingilizce.
 * `Record<AdminPushLang>` oldugu icin bir dil eksik kalirsa burasi derlenmez.
 */
export type AdminPushEvent = "dispute" | "partnerApplication" | "partnerLead" | "affiliateApplication";

export type AdminPushLang = "tr" | "en";

export type AdminPushVars = { name?: string; code?: string; reason?: string };

type Copy = Record<AdminPushEvent, (v: AdminPushVars) => { title: string; body: string }>;

export const ADMIN_PUSH_COPY: Record<AdminPushLang, Copy> = {
  tr: {
    dispute: (v) => ({ title: "Yeni şikayet", body: `Rezervasyon ${v.code ?? ""} · ${v.reason ?? ""}` }),
    partnerApplication: (v) => ({ title: "Yeni esnaf başvurusu", body: `${v.name ?? ""} onay bekliyor.` }),
    partnerLead: (v) => ({ title: "Esnaf ön kaydı", body: `${v.name ?? ""} aranmayı bekliyor.` }),
    affiliateApplication: (v) => ({ title: "Aracı başvurusu", body: `${v.name ?? ""} onay bekliyor.` }),
  },
  en: {
    dispute: (v) => ({ title: "New dispute", body: `Booking ${v.code ?? ""} · ${v.reason ?? ""}` }),
    partnerApplication: (v) => ({ title: "New partner application", body: `${v.name ?? ""} is waiting for approval.` }),
    partnerLead: (v) => ({ title: "Partner pre-registration", body: `${v.name ?? ""} is waiting for a call.` }),
    affiliateApplication: (v) => ({ title: "Affiliate application", body: `${v.name ?? ""} is waiting for approval.` }),
  },
};

/** Cihazin kayitli dili (`MobilePushToken.locale`, ornek `tr-TR`) -> yonetici push dili. */
export function adminPushLang(locale: string | null | undefined): AdminPushLang {
  return locale?.trim().toLowerCase().startsWith("tr") ? "tr" : "en";
}

/**
 * Bildirime dokununca acilacak yonetici ekrani. Istemci (`mobile-expo/src/lib/push.ts`)
 * yalnizca bu degerleri taniyor; serbest yol gonderilmez.
 */
export type AdminPushScreen = "dispute" | "applications" | "partnerLeads" | "affiliates";

export type AdminPushData = { adminScreen: AdminPushScreen; disputeId?: string };
