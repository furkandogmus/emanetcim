import type { AppLocale } from "@/i18n/locales";

/**
 * Misafire giden push metinleri (mobil ve web push ayni metni alir). Her olay e-postasinin kisa esi; `Record<AppLocale>`
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
  | "noShow"
  | "lateDropoff"
  | "lateHold"
  | "lateClosed"
  | "disputeInReview"
  | "disputeResolved"
  | "disputeClosed";

export type GuestPushVars = { shop: string; time?: string; total?: string; phone?: string };

type Copy = Record<GuestPushEvent, (v: GuestPushVars) => { title: string; body: string }>;

export const GUEST_PUSH_COPY: Record<AppLocale, Copy> = {
  tr: {
    approved: (v) => ({ title: "Rezervasyonun onaylandı", body: `${v.shop} seni bekliyor. QR kodun uygulamada.` }),
    cancelled: (v) => ({ title: "Rezervasyonun iptal edildi", body: v.shop }),
    checkIn: (v) => ({ title: "Valizin teslim alındı", body: `${v.shop} valizini teslim aldı. Alırken QR kodunu göster.` }),
    checkOut: (v) => ({ title: "Valizini aldın", body: `${v.shop} ile işin bitti. Deneyimini puanlayabilirsin.` }),
    reminderCheckIn: (v) => ({ title: "Bırakma saatin yaklaşıyor", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "Alma saatin yaklaşıyor", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Valizin hâlâ dükkanda", body: `Alma saatin geçti. Valizin ${v.shop} noktasında bekliyor.` }),
    bagRevision: (v) => ({ title: "Onayın gerekiyor", body: `${v.shop} valiz sayını düzeltti. Yeni toplam ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "Seni göremedik", body: `${v.shop} rezervasyonunu kapattı. Yeni bir rezervasyonla her zaman bekleriz.` }),
    lateDropoff: (v) => ({ title: "Bırakma saatin geçti", body: `${v.shop} rezervasyonun saat ${v.time ?? ""} itibarıyla otomatik kapanacak. Geliyorsan dükkanı ara${v.phone ? ` (${v.phone})` : ""}; gelemiyorsan yeni bir rezervasyon yap.` }),
    lateHold: (v) => ({ title: "Dükkan seni bekliyor", body: `${v.shop} rezervasyonunu senin için açık tutuyor. Son saat: ${v.time ?? ""}.` }),
    lateClosed: (v) => ({ title: "Rezervasyonun kapandı", body: `Bırakma saatin geçtiği için ${v.shop} rezervasyonun kapandı. Yeni bir rezervasyon yapabilirsin.` }),
    disputeInReview: (v) => ({ title: "Şikayetin inceleniyor", body: `${v.shop} rezervasyonundaki şikayetini ekibimiz inceliyor.` }),
    disputeResolved: (v) => ({ title: "Şikayetin sonuçlandı", body: `${v.shop} rezervasyonundaki şikayetin çözüldü. Ayrıntılar rezervasyonunda.` }),
    disputeClosed: (v) => ({ title: "Şikayetin kapatıldı", body: `${v.shop} rezervasyonundaki şikayetin kapatıldı. Ayrıntılar rezervasyonunda.` }),
  },
  en: {
    approved: (v) => ({ title: "Your booking is confirmed", body: `${v.shop} is expecting you. Your QR code is in the app.` }),
    cancelled: (v) => ({ title: "Your booking was cancelled", body: v.shop }),
    checkIn: (v) => ({ title: "Your bags are checked in", body: `${v.shop} checked in your bags. Show your QR code at pickup.` }),
    checkOut: (v) => ({ title: "Bags picked up", body: `All done at ${v.shop}. You can rate your visit.` }),
    reminderCheckIn: (v) => ({ title: "Drop-off time is coming up", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "Pickup time is coming up", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Your bags are still at the shop", body: `Your pickup time has passed. Your bags are waiting at ${v.shop}.` }),
    bagRevision: (v) => ({ title: "Your approval is needed", body: `${v.shop} corrected your bag count. New total ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "We missed you", body: `${v.shop} closed your booking. You are welcome to book again anytime.` }),
    lateDropoff: (v) => ({ title: "Your drop-off time has passed", body: `Your booking at ${v.shop} closes automatically at ${v.time ?? ""}. If you are on your way, call the shop${v.phone ? ` (${v.phone})` : ""}; otherwise make a new booking.` }),
    lateHold: (v) => ({ title: "The shop is waiting for you", body: `${v.shop} is holding your booking until ${v.time ?? ""}.` }),
    lateClosed: (v) => ({ title: "Your booking was closed", body: `Your booking at ${v.shop} was closed because the drop-off time passed. You can make a new booking.` }),
    disputeInReview: (v) => ({ title: "Your dispute is under review", body: `Our team is reviewing your dispute about ${v.shop}.` }),
    disputeResolved: (v) => ({ title: "Your dispute was resolved", body: `Your dispute about ${v.shop} was resolved. See your booking for details.` }),
    disputeClosed: (v) => ({ title: "Your dispute was closed", body: `Your dispute about ${v.shop} was closed. See your booking for details.` }),
  },
  de: {
    approved: (v) => ({ title: "Buchung bestätigt", body: `${v.shop} erwartet dich. Dein QR-Code ist in der App.` }),
    cancelled: (v) => ({ title: "Buchung storniert", body: v.shop }),
    checkIn: (v) => ({ title: "Gepäck abgegeben", body: `${v.shop} hat dein Gepäck angenommen. Zeig bei der Abholung deinen QR-Code.` }),
    checkOut: (v) => ({ title: "Gepäck abgeholt", body: `Alles erledigt bei ${v.shop}. Du kannst deinen Besuch bewerten.` }),
    reminderCheckIn: (v) => ({ title: "Abgabezeit rückt näher", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "Abholzeit rückt näher", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Dein Gepäck ist noch im Laden", body: `Deine Abholzeit ist vorbei. Dein Gepäck wartet bei ${v.shop}.` }),
    bagRevision: (v) => ({ title: "Deine Zustimmung ist nötig", body: `${v.shop} hat die Gepäckanzahl korrigiert. Neuer Gesamtbetrag ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "Wir haben dich verpasst", body: `${v.shop} hat deine Buchung geschlossen. Du kannst jederzeit neu buchen.` }),
    lateDropoff: (v) => ({ title: "Deine Abgabezeit ist vorbei", body: `Deine Buchung bei ${v.shop} wird um ${v.time ?? ""} automatisch geschlossen. Wenn du unterwegs bist, ruf den Laden an${v.phone ? ` (${v.phone})` : ""}; sonst buche neu.` }),
    lateHold: (v) => ({ title: "Der Laden wartet auf dich", body: `${v.shop} hält deine Buchung bis ${v.time ?? ""} offen.` }),
    lateClosed: (v) => ({ title: "Deine Buchung wurde geschlossen", body: `Deine Buchung bei ${v.shop} wurde geschlossen, weil die Abgabezeit überschritten wurde. Du kannst neu buchen.` }),
    disputeInReview: (v) => ({ title: "Deine Beschwerde wird geprüft", body: `Unser Team prüft deine Beschwerde zu ${v.shop}.` }),
    disputeResolved: (v) => ({ title: "Deine Beschwerde wurde gelöst", body: `Deine Beschwerde zu ${v.shop} wurde gelöst. Details findest du in deiner Buchung.` }),
    disputeClosed: (v) => ({ title: "Deine Beschwerde wurde geschlossen", body: `Deine Beschwerde zu ${v.shop} wurde geschlossen. Details findest du in deiner Buchung.` }),
  },
  fr: {
    approved: (v) => ({ title: "Réservation confirmée", body: `${v.shop} vous attend. Votre QR code est dans l'app.` }),
    cancelled: (v) => ({ title: "Réservation annulée", body: v.shop }),
    checkIn: (v) => ({ title: "Bagages déposés", body: `${v.shop} a pris en charge vos bagages. Montrez votre QR code au retrait.` }),
    checkOut: (v) => ({ title: "Bagages récupérés", body: `C'est terminé chez ${v.shop}. Vous pouvez noter votre visite.` }),
    reminderCheckIn: (v) => ({ title: "L'heure du dépôt approche", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "L'heure du retrait approche", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Vos bagages sont toujours au commerce", body: `L'heure de retrait est passée. Vos bagages vous attendent chez ${v.shop}.` }),
    bagRevision: (v) => ({ title: "Votre accord est nécessaire", body: `${v.shop} a corrigé le nombre de bagages. Nouveau total ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "Nous vous avons manqué", body: `${v.shop} a clôturé votre réservation. Vous pouvez réserver à nouveau à tout moment.` }),
    lateDropoff: (v) => ({ title: "L'heure de dépôt est passée", body: `Votre réservation chez ${v.shop} sera clôturée automatiquement à ${v.time ?? ""}. Si vous arrivez, appelez le commerce${v.phone ? ` (${v.phone})` : ""} ; sinon, faites une nouvelle réservation.` }),
    lateHold: (v) => ({ title: "Le commerce vous attend", body: `${v.shop} garde votre réservation jusqu'à ${v.time ?? ""}.` }),
    lateClosed: (v) => ({ title: "Votre réservation a été clôturée", body: `Votre réservation chez ${v.shop} a été clôturée car l'heure de dépôt est dépassée. Vous pouvez réserver à nouveau.` }),
    disputeInReview: (v) => ({ title: "Votre réclamation est en cours d'examen", body: `Notre équipe examine votre réclamation concernant ${v.shop}.` }),
    disputeResolved: (v) => ({ title: "Votre réclamation a été résolue", body: `Votre réclamation concernant ${v.shop} a été résolue. Les détails sont dans votre réservation.` }),
    disputeClosed: (v) => ({ title: "Votre réclamation a été clôturée", body: `Votre réclamation concernant ${v.shop} a été clôturée. Les détails sont dans votre réservation.` }),
  },
  ja: {
    approved: (v) => ({ title: "予約が確定しました", body: `${v.shop}がお待ちしています。QRコードはアプリにあります。` }),
    cancelled: (v) => ({ title: "予約がキャンセルされました", body: v.shop }),
    checkIn: (v) => ({ title: "お荷物をお預かりしました", body: `${v.shop}がお荷物をお預かりしました。受け取り時にQRコードを提示してください。` }),
    checkOut: (v) => ({ title: "お荷物を受け取りました", body: `${v.shop}でのご利用ありがとうございました。評価をお願いします。` }),
    reminderCheckIn: (v) => ({ title: "預け入れの時間が近づいています", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "受け取りの時間が近づいています", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "お荷物はまだ店舗にあります", body: `受け取り時間を過ぎました。お荷物は${v.shop}でお待ちしています。` }),
    bagRevision: (v) => ({ title: "承認が必要です", body: `${v.shop}が荷物の数を修正しました。新しい合計 ${v.total ?? ""}。` }),
    noShow: (v) => ({ title: "お会いできませんでした", body: `${v.shop}がご予約を終了しました。またいつでもご予約ください。` }),
    lateDropoff: (v) => ({ title: "預け入れ時間を過ぎました", body: `${v.shop}のご予約は${v.time ?? ""}に自動で終了します。向かっている場合は店舗にお電話ください${v.phone ? `（${v.phone}）` : ""}。難しい場合は新しくご予約ください。` }),
    lateHold: (v) => ({ title: "店舗がお待ちしています", body: `${v.shop}は${v.time ?? ""}までご予約を保持しています。` }),
    lateClosed: (v) => ({ title: "ご予約が終了しました", body: `預け入れ時間を過ぎたため、${v.shop}のご予約は終了しました。新しくご予約いただけます。` }),
    disputeInReview: (v) => ({ title: "お申し立てを確認しています", body: `${v.shop}に関するお申し立てを担当チームが確認しています。` }),
    disputeResolved: (v) => ({ title: "お申し立てが解決しました", body: `${v.shop}に関するお申し立てが解決しました。詳細はご予約をご確認ください。` }),
    disputeClosed: (v) => ({ title: "お申し立てが終了しました", body: `${v.shop}に関するお申し立てが終了しました。詳細はご予約をご確認ください。` }),
  },
  fa: {
    approved: (v) => ({ title: "رزرو شما تأیید شد", body: `${v.shop} منتظر شماست. کد QR در برنامه است.` }),
    cancelled: (v) => ({ title: "رزرو شما لغو شد", body: v.shop }),
    checkIn: (v) => ({ title: "چمدان شما تحویل گرفته شد", body: `${v.shop} چمدان شما را تحویل گرفت. هنگام تحویل کد QR را نشان دهید.` }),
    checkOut: (v) => ({ title: "چمدان خود را تحویل گرفتید", body: `کار شما در ${v.shop} تمام شد. می‌توانید امتیاز دهید.` }),
    reminderCheckIn: (v) => ({ title: "زمان تحویل دادن نزدیک است", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "زمان تحویل گرفتن نزدیک است", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "چمدان شما هنوز در فروشگاه است", body: `زمان تحویل گذشته است. چمدان شما در ${v.shop} منتظر است.` }),
    bagRevision: (v) => ({ title: "تأیید شما لازم است", body: `${v.shop} تعداد چمدان‌ها را اصلاح کرد. مبلغ جدید ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "شما را ندیدیم", body: `${v.shop} رزرو شما را بست. هر زمان خواستید دوباره رزرو کنید.` }),
    lateDropoff: (v) => ({ title: "زمان تحویل دادن گذشته است", body: `رزرو شما در ${v.shop} ساعت ${v.time ?? ""} به‌طور خودکار بسته می‌شود. اگر در راه هستید با فروشگاه تماس بگیرید${v.phone ? ` (${v.phone})` : ""}؛ وگرنه رزرو جدیدی ثبت کنید.` }),
    lateHold: (v) => ({ title: "فروشگاه منتظر شماست", body: `${v.shop} رزرو شما را تا ساعت ${v.time ?? ""} نگه می‌دارد.` }),
    lateClosed: (v) => ({ title: "رزرو شما بسته شد", body: `چون زمان تحویل دادن گذشت، رزرو شما در ${v.shop} بسته شد. می‌توانید دوباره رزرو کنید.` }),
    disputeInReview: (v) => ({ title: "شکایت شما در حال بررسی است", body: `تیم ما در حال بررسی شکایت شما درباره ${v.shop} است.` }),
    disputeResolved: (v) => ({ title: "شکایت شما حل شد", body: `شکایت شما درباره ${v.shop} حل شد. جزئیات در رزرو شماست.` }),
    disputeClosed: (v) => ({ title: "شکایت شما بسته شد", body: `شکایت شما درباره ${v.shop} بسته شد. جزئیات در رزرو شماست.` }),
  },
  ru: {
    approved: (v) => ({ title: "Бронирование подтверждено", body: `${v.shop} ждёт вас. QR-код находится в приложении.` }),
    cancelled: (v) => ({ title: "Бронирование отменено", body: v.shop }),
    checkIn: (v) => ({ title: "Багаж принят", body: `${v.shop} принял ваш багаж. При получении покажите QR-код.` }),
    checkOut: (v) => ({ title: "Багаж получен", body: `Всё готово в ${v.shop}. Вы можете оценить визит.` }),
    reminderCheckIn: (v) => ({ title: "Скоро время сдачи багажа", body: `${v.shop} · ${v.time ?? ""}` }),
    reminderCheckOut: (v) => ({ title: "Скоро время забрать багаж", body: `${v.shop} · ${v.time ?? ""}` }),
    overdue: (v) => ({ title: "Ваш багаж всё ещё в магазине", body: `Время получения прошло. Ваш багаж ждёт вас в ${v.shop}.` }),
    bagRevision: (v) => ({ title: "Нужно ваше подтверждение", body: `${v.shop} исправил количество мест багажа. Новая сумма: ${v.total ?? ""}.` }),
    noShow: (v) => ({ title: "Мы вас не дождались", body: `${v.shop} закрыл ваше бронирование. Будем рады новому бронированию в любое время.` }),
    lateDropoff: (v) => ({ title: "Время сдачи багажа прошло", body: `Ваше бронирование в ${v.shop} автоматически закроется в ${v.time ?? ""}. Если вы уже в пути, позвоните в магазин${v.phone ? ` (${v.phone})` : ""}; в противном случае оформите новое бронирование.` }),
    lateHold: (v) => ({ title: "Магазин ждёт вас", body: `${v.shop} сохраняет ваше бронирование до ${v.time ?? ""}.` }),
    lateClosed: (v) => ({ title: "Бронирование закрыто", body: `Ваше бронирование в ${v.shop} закрыто, так как время сдачи багажа прошло. Вы можете оформить новое бронирование.` }),
    disputeInReview: (v) => ({ title: "Ваша претензия на рассмотрении", body: `Наша команда рассматривает вашу претензию по ${v.shop}.` }),
    disputeResolved: (v) => ({ title: "Ваша претензия урегулирована", body: `Ваша претензия по ${v.shop} урегулирована. Подробности в бронировании.` }),
    disputeClosed: (v) => ({ title: "Ваша претензия закрыта", body: `Ваша претензия по ${v.shop} закрыта. Подробности в бронировании.` }),
  },
};

/** Uyusmazlik olaylari; web push'a dokununca uyusmazlik sayfasi acilir. */
const DISPUTE_EVENTS: ReadonlySet<GuestPushEvent> = new Set(["disputeInReview", "disputeResolved", "disputeClosed"]);

/**
 * Web push tiklama hedefi (dil oneksiz; `src/proxy.ts` dile yonlendirir). `undefined`
 * ise worker `bookingId`den rezervasyon sayfasini kurar (`public/push-sw.js`).
 */
export function guestPushWebPath(event: GuestPushEvent, bookingId: string): string | undefined {
  return DISPUTE_EVENTS.has(event) ? `/bookings/${bookingId}/dispute` : undefined;
}
