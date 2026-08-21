import { notFound } from "next/navigation";

/**
 * /[locale]/ altında eşleşmeyen tüm yollar → locale not-found.tsx (KAYBOLDUN vb.)
 *
 * `force-dynamic` NEDEN GEREKLİ: bu route statik olarak önceden render edilirse
 * `notFound()` build zamanında bir kez çalışır ve sonuç, üretimde **HTTP 200** ile
 * servis edilen bir statik sayfaya dönüşür. 2026-08-22'de ölçüldü: kullanıcı doğru
 * ekranı ("KAYBOLDUN!") görüyordu ama `/tr/olmayan-sayfa` **200** dönüyordu — hem
 * Cloudflare hem nginx elendi, 200'ü Next'in kendisi üretiyordu (container içinden
 * doğrulandı). Soft-404, arama motorunun uydurma URL'leri geçerli içerik olarak
 * indekslemesine yol açar; ürün organik aramaya dayandığı için bu pahalı.
 *
 * Doğrulama (deploy sonrası tek satır):
 *   curl -o /dev/null -w '%{http_code}' https://<host>/tr/olmayan-bir-sayfa
 *   -> 404 beklenir. 200 görürsen bu satır çalışmıyor demektir.
 */
export const dynamic = "force-dynamic";

export default function CatchAllLocale() {
  notFound();
}
