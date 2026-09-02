/**
 * Bir rezervasyona KİMİN erişebileceği.
 *
 * NEDEN ORTAK (2026-08-26'da ölçüldü): kural üç mobil uçta elle yazılmıştı
 * (`bookings/[id]`, `.../cancel`, `.../modify`) ve aralarında **kasıtlı ama
 * yazısız** bir fark vardı:
 *
 *   - OKUMA: misafirin kendisi, dükkan sahibi esnaf, veya admin
 *   - DEĞİŞTİRME (iptal/düzenleme): yalnızca misafirin kendisi veya admin
 *
 * Esnafın bir misafirin rezervasyonunu iptal edememesi DOĞRU: esnafın yolu
 * "reddet"tir ve o yol iade ile slot temizliğini `cancelBooking` üzerinden
 * yürütür. Ama bu fark üç kopyanın arasında yazısız duruyordu; biri
 * güncellenirken diğerinin geride kalması an meselesiydi.
 *
 * Fark artık ADI OLAN bir parametre: `allowShopPartner`.
 */

export type BookingActor = { id: string; role: string };

/**
 * Yalnizca dukkan sahipligi soruluyorsa gereken en dar kume.
 *
 * `BookingAccessSubject` DEGIL: `canOperateBookingAtShop` `guestId`ye hic
 * bakmiyor, dolayisiyla onu istemek cagiranlari gereksiz alan secmeye zorlar.
 * Nitekim `check-out` ucu `guestId` secmiyordu ve genis tip derleme hatasi
 * verdi -- tipi daraltmak, sorguya kullanilmayan bir alan eklemekten dogru.
 */
export type ShopOwnedSubject = {
  shop: { ownerId: string };
};

export type BookingAccessSubject = ShopOwnedSubject & {
  guestId: string | null;
};

/**
 * `allowShopPartner`: dükkan sahibi esnaf da erişebilir mi?
 * OKUMA için `true` (esnaf paneli rezervasyonu görmeli),
 * DEĞİŞTİRME için `false` (esnafın yolu "reddet").
 */
export function canAccessBooking(
  booking: BookingAccessSubject,
  actor: BookingActor,
  opts: { allowShopPartner: boolean },
): boolean {
  if (actor.role === "ADMIN") return true;
  if (booking.guestId && booking.guestId === actor.id) return true;
  if (opts.allowShopPartner && actor.role === "PARTNER") {
    return booking.shop.ownerId === actor.id;
  }
  return false;
}

/**
 * DÜKKAN OPERASYONU: check-in, check-out, mühür tarama.
 *
 * `canAccessBooking`ten ayrı, çünkü buradaki küme MİSAFİRİ DIŞARIDA bırakır:
 * valizi teslim alan, teslim eden ve mührü okutan taraf dükkandır. Misafirin
 * kendi rezervasyonunu "teslim aldım" diye işaretlemesi anlamsız olurdu.
 *
 * NEDEN EKLENDİ (2026-09-02): bu dosyanın kendi gerekçesi "kural üç mobil uçta
 * elle yazılmıştı" diyor ve 2026-08-26'da o üçü (`bookings/[id]`, `cancel`,
 * `modify`) ortak kapıya alınmış. Ama AYNI temizlikten geçmeyen üç uç daha
 * vardı -- `check-in`, `check-out`, `seals/scan` -- ve üçü de kuralı hâlâ elle
 * yazıyordu:
 *
 *     if (auth.user.role !== "ADMIN" && booking.shop.ownerId !== auth.user.id)
 *
 * Üç kopya, üç ayrı satır, tek kural. Davranış bugün doğruydu; kopya olmasının
 * bedeli, birinin değişip diğer ikisinin geride kalması.
 *
 * Sahiplik rol ŞARTI ARAMAZ (mevcut davranış korunuyor): dükkanın sahibi olan
 * bir kullanıcı, rolü ne olursa olsun kendi dükkanının işini yapabilmeli --
 * başvuru onayı sırasında rol geçişi olabiliyor.
 */
export function canOperateBookingAtShop(
  booking: ShopOwnedSubject,
  actor: BookingActor,
): boolean {
  if (actor.role === "ADMIN") return true;
  return booking.shop.ownerId === actor.id;
}
