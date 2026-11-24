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

import { hasShopAccess } from "@/lib/shop-access";

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
  shop: { id: string; ownerId: string };
};

export type BookingAccessSubject = ShopOwnedSubject & {
  guestId: string | null;
};

/**
 * `allowShopPartner`: dükkan sahibi esnaf da erişebilir mi?
 * OKUMA için `true` (esnaf paneli rezervasyonu görmeli),
 * DEĞİŞTİRME için `false` (esnafın yolu "reddet").
 */
export async function canAccessBooking(
  booking: BookingAccessSubject,
  actor: BookingActor,
  opts: { allowShopPartner: boolean },
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (booking.guestId && booking.guestId === actor.id) return true;
  // Dukkan tarafi = sahip ya da personel (`operate`); rol sartinin yerini uyelik aldi.
  if (opts.allowShopPartner) return hasShopAccess(actor, booking.shop, "operate");
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
): Promise<boolean> {
  return hasShopAccess(actor, booking.shop, "operate");
}

/**
 * Esnaf iptali gibi `manage` seviyesindeki rezervasyon islemleri: sahip ya da yonetici.
 * Personel burada YOK (urun karari 2026-11-24: personel = yalniz operasyon).
 */
export function canManageBookingAtShop(booking: ShopOwnedSubject, actor: BookingActor): boolean {
  if (actor.role === "ADMIN") return true;
  return booking.shop.ownerId === actor.id;
}

/**
 * MUHUR OPERASYONU: tarama, atama. `canOperateBookingAtShop` ile AYNI kural
 * (ADMIN her zaman, esnaf yalnizca kendi dukkani) ama konu mühür olduğunda —
 * `Seal.shopId` NULLABLE (stoktaki muhur henuz hicbir dukkana atanmamis
 * olabilir), o yuzden `shop` de opsiyonel: atanmamis bir muhur icin esnaf
 * HICBIR ZAMAN "sahibiyim" diyemez, yalnizca ADMIN gorebilir.
 *
 * NEDEN AYRI (2026-09-10'da bulundu): `seals/scan` bu kontrolu HIC yapmiyordu
 * -- herhangi bir kimliklenmis PARTNER, seri numarasini deneyerek (ardisik)
 * BASKA dukkanlarin muhur envanterini gorebiliyordu (IDOR).
 */
export async function canOperateSealAtShop(
  seal: { shop: { id: string; ownerId: string } | null },
  actor: BookingActor,
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (!seal.shop) return false;
  return hasShopAccess(actor, seal.shop, "operate");
}

/**
 * MISAFIRIN KENDI IPTALI: yalnizca rezervasyonun sahibi. ADMIN DAHIL DEGIL --
 * yonetici bu yoldan gecseydi zorunlu aciklama ve `admin.booking.cancel`
 * denetim kaydi atlanirdi; onun yolu yonetici iptalidir. Goruntuleme
 * oturumunda aktor misafirin kendisidir, o yuzden gecer.
 */
export function canGuestSelfCancel(booking: { guestId: string | null }, actor: BookingActor): boolean {
  return !!booking.guestId && booking.guestId === actor.id;
}
