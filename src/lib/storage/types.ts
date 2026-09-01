/**
 * Nesne depolama PORT'u (hexagonal) — `src/lib/payments/types.ts` ile aynı kalıp.
 *
 * NEDEN VAR (2026-09-01): iki ayrı yerde "kolon var, yazan kod yok" durumu
 * ölçüldü ve ikisinin de tek engeli bir DEPOLAMA kararıydı:
 *
 *   - `Shop.image` ve `ShopImage` — misafir vitrininde çiziliyor, hiçbir kod
 *     yazmıyor. Pazar yerinde her dükkan kalıcı olarak fotoğrafsız.
 *   - `BookingSeal.photoUrl` — üç yerde vaat edilen "teslimde mühür ve
 *     fotoğraf"ın fotoğraf yarısı; tek çağıran sabit `null` geçiyor.
 *
 * Karar S3 olarak verildi. Port yine de duruyor çünkü sağlayıcıyı değiştirmek
 * (R2, CloudFront önü, yerel disk) çağıranların hiçbirini değiştirmemeli.
 *
 * BASE64'Ü VERİTABANINA YAZMAK SEÇENEK DEĞİLDİ: bu kod tabanı o hatayı bir kez
 * yaşadı — misafir avatarları 2 MB'a kadar base64 geliyordu ve
 * `include: { guest: true }` yapan her sorgu onu da çekiyordu.
 */

export type StorageCapabilities = {
  /** Adaptör kimliği — kayıtlarda ve loglarda görünen ad. */
  id: string;
  /** Yüklenen nesne herkese açık bir URL'den okunabiliyor mu? */
  servesPublicUrls: boolean;
};

export type PutObjectInput = {
  /** Nesne anahtarı. `buildObjectKey` ile üretilir; kullanıcı metni içermez. */
  key: string;
  body: Uint8Array;
  /** SUNUCUDA tespit edilmiş tür — istemcinin beyanı değil. */
  contentType: string;
};

export type PutObjectResult = {
  key: string;
  /** Nesnenin okunabileceği URL. */
  url: string;
};

export interface StoragePort {
  readonly capabilities: StorageCapabilities;
  put(input: PutObjectInput): Promise<PutObjectResult>;
  /** Nesneyi siler. Olmayan anahtarda HATA VERMEZ — silme idempotenttir. */
  remove(key: string): Promise<void>;
  /** Anahtardan herkese açık URL üretir (yazmadan). */
  publicUrl(key: string): string;
}
