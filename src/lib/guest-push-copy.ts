import type { AppLocale } from "@/i18n/locales";

/**
 * Misafire giden mobil push metinleri. Her olay e-postasinin kisa esi; `Record<AppLocale>`
 * oldugu icin yeni bir dil eklendiginde burasi derlenmez.
 */
export type GuestPushEvent =
  | "approved"
  | "cancelled"
  | "checkIn"
  | "checkOut"
  | "reminderCheckIn"
  | "reminderCheckOut"
  | "overdue"
  | "bagRevision"
  | "noShow";

export type GuestPushVars = { shop: string; time?: string; total?: string };

type Copy = Record<GuestPushEvent, (v: GuestPushVars) => { title: string; body: string }>;

export const GUEST_PUSH_COPY: Record<AppLocale, Copy> = {
  tr: {
    approved: (v) => ({ title: "Rezervasyonun onaylandı", body: `${v.shop} seni bekliyor. QR kodun uygulamada.` }),
    cancelled: (v) => ({ title: "Rezervasyonun iptal edildi", body: v.shop }),
    checkIn: (v) => ({ title: "Valizin teslim alındı", body: `${v.shop} valizini mühürledi. Alırken QR kodunu göster.` }),
    checkOut: (v) => ({ title: "Valizini aldın", body: `${v.shop} ile işin bitti. Deneyimini puanlayabilirsin.` }),
    reminderCheckIn: (v) => ({ title: "Bırakma saatin yaklaşıyor", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "Alma saatin yaklaşıyor", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Valizin hâlâ dükkanda", body: `Alma saatin geçti. Valizin ${v.shop} noktasında bekliyor.` }),
    bagRevision: (v) => ({ title: "Onayın gerekiyor", body: `${v.shop} valiz sayını düzeltti. Yeni toplam ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "Seni göremedik", body: `${v.shop} rezervasyonunu kapattı. Yeni bir rezervasyonla her zaman bekleriz.` }),
  },
  en: {
    approved: (v) => ({ title: "Your booking is confirmed", body: `${v.shop} is expecting you. Your QR code is in the app.` }),
    cancelled: (v) => ({ title: "Your booking was cancelled", body: v.shop }),
    checkIn: (v) => ({ title: "Your bags are checked in", body: `${v.shop} sealed your bags. Show your QR code at pickup.` }),
    checkOut: (v) => ({ title: "Bags picked up", body: `All done at ${v.shop}. You can rate your visit.` }),
    reminderCheckIn: (v) => ({ title: "Drop-off time is coming up", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "Pickup time is coming up", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Your bags are still at the shop", body: `Your pickup time has passed. Your bags are waiting at ${v.shop}.` }),
    bagRevision: (v) => ({ title: "Your approval is needed", body: `${v.shop} corrected your bag count. New total ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "We missed you", body: `${v.shop} closed your booking. You are welcome to book again anytime.` }),
  },
  de: {
    approved: (v) => ({ title: "Buchung bestätigt", body: `${v.shop} erwartet dich. Dein QR-Code ist in der App.` }),
    cancelled: (v) => ({ title: "Buchung storniert", body: v.shop }),
    checkIn: (v) => ({ title: "Gepäck abgegeben", body: `${v.shop} hat dein Gepäck versiegelt. Zeig bei der Abholung deinen QR-Code.` }),
    checkOut: (v) => ({ title: "Gepäck abgeholt", body: `Alles erledigt bei ${v.shop}. Du kannst deinen Besuch bewerten.` }),
    reminderCheckIn: (v) => ({ title: "Abgabezeit rückt näher", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "Abholzeit rückt näher", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Dein Gepäck ist noch im Laden", body: `Deine Abholzeit ist vorbei. Dein Gepäck wartet bei ${v.shop}.` }),
    bagRevision: (v) => ({ title: "Deine Zustimmung ist nötig", body: `${v.shop} hat die Gepäckanzahl korrigiert. Neuer Gesamtbetrag ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "Wir haben dich verpasst", body: `${v.shop} hat deine Buchung geschlossen. Du kannst jederzeit neu buchen.` }),
  },
  fr: {
    approved: (v) => ({ title: "Réservation confirmée", body: `${v.shop} vous attend. Votre QR code est dans l'app.` }),
    cancelled: (v) => ({ title: "Réservation annulée", body: v.shop }),
    checkIn: (v) => ({ title: "Bagages déposés", body: `${v.shop} a scellé vos bagages. Montrez votre QR code au retrait.` }),
    checkOut: (v) => ({ title: "Bagages récupérés", body: `C'est terminé chez ${v.shop}. Vous pouvez noter votre visite.` }),
    reminderCheckIn: (v) => ({ title: "L'heure du dépôt approche", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "L'heure du retrait approche", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Vos bagages sont toujours au commerce", body: `L'heure de retrait est passée. Vos bagages vous attendent chez ${v.shop}.` }),
    bagRevision: (v) => ({ title: "Votre accord est nécessaire", body: `${v.shop} a corrigé le nombre de bagages. Nouveau total ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "Nous vous avons manqué", body: `${v.shop} a clôturé votre réservation. Vous pouvez réserver à nouveau à tout moment.` }),
  },
  ja: {
    approved: (v) => ({ title: "予約が確定しました", body: `${v.shop}がお待ちしています。QRコードはアプリにあります。` }),
    cancelled: (v) => ({ title: "予約がキャンセルされました", body: v.shop }),
    checkIn: (v) => ({ title: "お荷物をお預かりしました", body: `${v.shop}がお荷物を封印しました。受け取り時にQRコードを提示してください。` }),
    checkOut: (v) => ({ title: "お荷物を受け取りました", body: `${v.shop}でのご利用ありがとうございました。評価をお願いします。` }),
    reminderCheckIn: (v) => ({ title: "預け入れの時間が近づいています", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "受け取りの時間が近づいています", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "お荷物はまだ店舗にあります", body: `受け取り時間を過ぎました。お荷物は${v.shop}でお待ちしています。` }),
    bagRevision: (v) => ({ title: "承認が必要です", body: `${v.shop}が荷物の数を修正しました。新しい合計 ${v.total ?? ""}。` }),
    noShow: (v) => ({ title: "お会いできませんでした", body: `${v.shop}がご予約を終了しました。またいつでもご予約ください。` }),
  },
  fa: {
    approved: (v) => ({ title: "رزرو شما تأیید شد", body: `${v.shop} منتظر شماست. کد QR در برنامه است.` }),
    cancelled: (v) => ({ title: "رزرو شما لغو شد", body: v.shop }),
    checkIn: (v) => ({ title: "چمدان شما تحویل گرفته شد", body: `${v.shop} چمدان شما را پلمب کرد. هنگام تحویل کد QR را نشان دهید.` }),
    checkOut: (v) => ({ title: "چمدان خود را تحویل گرفتید", body: `کار شما در ${v.shop} تمام شد. می‌توانید امتیاز دهید.` }),
    reminderCheckIn: (v) => ({ title: "زمان تحویل دادن نزدیک است", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "زمان تحویل گرفتن نزدیک است", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "چمدان شما هنوز در فروشگاه است", body: `زمان تحویل گذشته است. چمدان شما در ${v.shop} منتظر است.` }),
    bagRevision: (v) => ({ title: "تأیید شما لازم است", body: `${v.shop} تعداد چمدان‌ها را اصلاح کرد. مبلغ جدید ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "شما را ندیدیم", body: `${v.shop} رزرو شما را بست. هر زمان خواستید دوباره رزرو کنید.` }),
  },
};
