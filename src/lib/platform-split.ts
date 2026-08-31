/**
 * Platform/esnaf paylaşımı — SAF hesap.
 *
 * Oran ARTIK ORTAM DEĞİŞKENİNDEN OKUNMUYOR. Eskiden `PLATFORM_COMMISSION_RATE`
 * yoksa kodda yazılı `0.5`'e sessizce düşüyordu: env bir deploy'da kaybolsa
 * esnaf, kimse fark etmeden parasının yarısını alırdı — bu projeyi bu hale
 * getiren "yanlış varsayılan, gerçekmiş gibi görünen para" hatasının aynısı.
 * Oran artık `PricingRules.platformCommissionRate` ile ÇAĞIRAN TARAFINDAN
 * verilir; nereden geldiği tek yerde bellidir.
 */

/** Oranı geçerli aralığa çeker. 0..1 dışındaki bir değer hesabı anlamsız kılar. */
export function clampCommissionRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.min(1, Math.max(0, rate));
}

export type SplitAmounts = {
  grossAmount: number;
  /** Hesapta kullanılan oran — kayda da bu yazılır (enstantane). */
  commissionRate: number;
  platformCommission: number;
  merchantAmount: number;
};

/**
 * Brüt tutarı platform komisyonu ile esnaf payına böler.
 *
 * YUVARLAMA: iki tarafı ayrı ayrı yuvarlamak kuruş kaçırır (120,005 gibi bir
 * tutarda toplam brütü tutmaz). Bu yüzden önce esnaf payı yuvarlanır, komisyon
 * FARKTAN bulunur. Böylece `platformCommission + merchantAmount === grossAmount`
 * her zaman doğrudur — mutabakatta bir kuruşluk açık aramak zorunda kalmayın.
 */
export function computeSplit(grossAmount: number, rate: number): SplitAmounts {
  const commissionRate = clampCommissionRate(rate);
  const gross = Math.round(grossAmount * 100) / 100;
  const merchantAmount = Math.round(gross * (1 - commissionRate) * 100) / 100;
  const platformCommission = Math.round((gross - merchantAmount) * 100) / 100;
  return { grossAmount: gross, commissionRate, platformCommission, merchantAmount };
}

/** Esnaf payı. Kalan tutar platform komisyonudur. */
export function computeSubMerchantShare(totalPrice: number, rate: number): number {
  return computeSplit(totalPrice, rate).merchantAmount;
}

/** Esnafın brüt tutardan aldığı oran (1 - platform komisyonu). UI / Partner paneli için. */
export function getMerchantShareRatio(rate: number): number {
  return 1 - clampCommissionRate(rate);
}

/**
 * Hakedişe SAYILAN rezervasyon durumları — tek doğru kaynak.
 *
 * Neden burada: partner ana paneli ile kazanç sayfası bu kümeyi ayrı ayrı, farklı
 * tanımlarla hesaplıyordu. Ana panel "CANCELLED olmayan her şey" diyordu ve bu yüzden
 * henüz ÖDENMEMİŞ (APPROVED / WAITING_APPROVAL / PENDING) rezervasyonları da kazanç
 * sayıyordu; kazanç sayfası ise yalnızca ödenmiş/teslim alınmış olanları sayıyordu.
 * Sonuç: aynı dükkan için iki ekranda iki farklı "NET HAKEDİŞ" (2026-08-22'de canlıda
 * 710 TL ve 490 TL olarak görüldü — brüt 1420 ve 980). Esnaf ne kadar alacağı olduğunu
 * bilemiyordu.
 *
 * Doğru tanım ödenmiş olandır: onaylanmış ama parası alınmamış bir rezervasyon
 * hakediş değildir.
 */
export const EARNING_BOOKING_STATUSES = [
  "PAID",
  "CHECKED_IN",
  "CHECKED_OUT",
] as const;

/** Bir rezervasyon durumu hakedişe sayılıyor mu? */
export function countsTowardEarnings(status: string): boolean {
  return (EARNING_BOOKING_STATUSES as readonly string[]).includes(status);
}

/**
 * TAHSİLAT YAPAMAYAN PLATFORM KOMİSYON DA ALAMAZ.
 *
 * NEDEN VAR (2026-08-31'de karar verildi, üretimde ölçüldü): aktif sağlayıcı
 * `manual` — para misafirden DÜKKANDA, esnafın kendi kasasına/POS'una giriyor.
 * Platformun parayı görmediği bir akışta komisyon, esnafa kesilen bir FATURA
 * demektir. `PlatformSettings.platformCommissionRate` ise üretimde **0.5000**
 * duruyordu ve şu üç sonucu üretiyordu:
 *
 * 1. `PaymentService` her tahsilatta `PaymentSplit`'e %50'lik bir platform
 *    komisyonu DONDURUYORDU. O satırlar defterde kalıcıdır ve karşılığında
 *    hiçbir zaman para hareketi olmayacaktı — yani tahsil edilmeyecek bir
 *    alacak birikiyordu. `PaymentLog`'daki "karşılığı olmayan 3.480 TRY"
 *    soruşturmasının (`DEFECT_BACKLOG` P1-5) aynı sınıfı.
 * 2. Esnaf panelinde "Net Hakediş" kasasındakinin YARISINI gösteriyordu.
 * 3. `become-partner` sayfasındaki kazanç hesaplayıcısı, kazanmaya çalıştığı
 *    esnafa **%50 komisyon** vaat ediyordu.
 *
 * Kural bir AYAR DEĞİL, sağlayıcının yeteneğinin sonucu: oran ancak platform
 * parayı kendi topluyorsa (`capturesOnline`) uygulanabilir. Böylece komisyonu
 * açmak, PSP'yi bağlamakla AYNI hareket olur — biri açılıp diğeri unutulamaz.
 * `payment-copy.ts` metin tarafında aynı kuralı uyguluyor.
 */
export function effectiveCommissionRate(
  configuredRate: number,
  capturesOnline: boolean,
): number {
  return capturesOnline ? clampCommissionRate(configuredRate) : 0;
}
