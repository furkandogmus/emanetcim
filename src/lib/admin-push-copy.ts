/**
 * Yoneticilere giden mobil push metinleri (2026-11-23). Yonetici olaylari (sikayet,
 * esnaf basvurusu, esnaf on kaydi, araci basvurusu) eskiden yalnizca e-posta (+SMS)
 * ile geliyordu; uygulamadaki yonetici telefondan habersiz kaliyordu.
 *
 * Yonetim masasi Turkce/Ingilizce: cihaz dili `tr` ise Turkce, degilse Ingilizce.
 * `Record<AdminPushLang>` oldugu icin bir dil eksik kalirsa burasi derlenmez.
 */
export type AdminPushEvent =
  | "dispute"
  | "partnerApplication"
  | "partnerLead"
  | "affiliateApplication"
  | "accountDeletion"
  | "reviewReport";

export type AdminPushLang = "tr" | "en";

export type AdminPushVars = { name?: string; code?: string; reason?: string };

type Copy = Record<AdminPushEvent, (v: AdminPushVars) => { title: string; body: string }>;

/** Sikayet nedeni (`CreateDisputeInput.reason`) -> push'ta okunur etiket; bilinmeyen deger "Diger"e duser. */
export type AdminDisputeReason = "DAMAGE" | "THEFT" | "OTHER";

const DISPUTE_REASON: Record<AdminPushLang, Record<AdminDisputeReason, string>> = {
  tr: { DAMAGE: "Hasar", THEFT: "Hırsızlık", OTHER: "Diğer" },
  en: { DAMAGE: "Damage", THEFT: "Theft", OTHER: "Other" },
};

export function disputeReasonLabel(lang: AdminPushLang, reason: string | undefined): string {
  const table = DISPUTE_REASON[lang];
  return reason && reason in table ? table[reason as AdminDisputeReason] : table.OTHER;
}

/*
  Push kilit ekranina duser: basvuranin e-postasi/telefonu buraya YAZILMAZ. Ad yoksa
  genel metin gider; ayrintisi uygulamadaki ekranda.
*/
export const ADMIN_PUSH_COPY: Record<AdminPushLang, Copy> = {
  tr: {
    dispute: (v) => ({ title: "Yeni şikayet", body: `Rezervasyon ${v.code ?? ""} · ${disputeReasonLabel("tr", v.reason)}` }),
    partnerApplication: (v) => ({
      title: "Yeni esnaf başvurusu",
      body: v.name ? `${v.name} onay bekliyor.` : "Yeni bir esnaf başvurusu onay bekliyor.",
    }),
    partnerLead: (v) => ({
      title: "Esnaf ön kaydı",
      body: v.name ? `${v.name} aranmayı bekliyor.` : "Yeni bir ön kayıt aranmayı bekliyor.",
    }),
    affiliateApplication: (v) => ({
      title: "Aracı başvurusu",
      body: v.name ? `${v.name} onay bekliyor.` : "Yeni bir aracı başvurusu onay bekliyor.",
    }),
    accountDeletion: (v) => ({
      title: "Hesap silme talebi",
      body: v.name ? `${v.name} hesabını silmek istiyor.` : "Bir hesap silme talebi bekliyor.",
    }),
    // Yorum metni kilit ekranina dusmez; ayrinti moderasyon ekraninda.
    reviewReport: (v) => ({
      title: "Yorum bildirildi",
      body: v.code ? `${v.code} şikayetle bir yorum incelemeyi bekliyor.` : "Bildirilen bir yorum incelemeyi bekliyor.",
    }),
  },
  en: {
    dispute: (v) => ({ title: "New dispute", body: `Booking ${v.code ?? ""} · ${disputeReasonLabel("en", v.reason)}` }),
    partnerApplication: (v) => ({
      title: "New partner application",
      body: v.name ? `${v.name} is waiting for approval.` : "A new partner application is waiting for approval.",
    }),
    partnerLead: (v) => ({
      title: "Partner pre-registration",
      body: v.name ? `${v.name} is waiting for a call.` : "A new pre-registration is waiting for a call.",
    }),
    affiliateApplication: (v) => ({
      title: "Affiliate application",
      body: v.name ? `${v.name} is waiting for approval.` : "A new affiliate application is waiting for approval.",
    }),
    accountDeletion: (v) => ({
      title: "Account deletion request",
      body: v.name ? `${v.name} wants to delete their account.` : "An account deletion request is waiting.",
    }),
    reviewReport: (v) => ({
      title: "Review reported",
      body: v.code ? `A review with ${v.code} reports is waiting for moderation.` : "A reported review is waiting for moderation.",
    }),
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
export type AdminPushScreen =
  | "dispute"
  | "applications"
  | "partnerLeads"
  | "affiliates"
  | "accountDeletions"
  | "reviews";

export type AdminPushData = { adminScreen: AdminPushScreen; disputeId?: string };
