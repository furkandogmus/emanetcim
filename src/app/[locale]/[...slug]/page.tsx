import { notFound } from "next/navigation";

/**
 * /[locale]/ altında eşleşmeyen tüm yollar → locale not-found.tsx (KAYBOLDUN vb.)
 *
 * BİLİNEN DAVRANIŞ (2026-08-22'de ölçüldü): bu route eşleştiği için Next yanıtı
 * **HTTP 200** ile döner, 404 ile değil — yani teknik olarak "soft-404".
 *
 * Ama zararı sanıldığı gibi değil: Next, `notFound()` durumunda sayfaya
 * `<meta name="robots" content="noindex">` enjekte ediyor (geçerli sayfalarda bu
 * etiket yok, karşılaştırıldı). Yani arama motoru bu URL'leri **indekslemiyor**;
 * yalnızca durum kodu ideal değil.
 *
 * `export const dynamic = "force-dynamic"` denendi ve İŞE YARAMADI (durum hâlâ
 * 200), o yüzden geri alındı — faydası olmayan ama statik optimizasyonu kapatan
 * bir satır taşımanın anlamı yok.
 *
 * Gerçek çözüm bu dosyayı SİLMEK olurdu: catch-all olmadan eşleşmeyen URL'ler
 * hiçbir route'a düşmez ve Next kendi 404'ünü doğru durum koduyla döner. Ama o
 * zaman markalı "KAYBOLDUN!" ekranının korunup korunmayacağı doğrulanmalı.
 * `noindex` zaten devrede olduğu için bu iş düşük öncelikli
 * (bkz. `docs/DEFECT_BACKLOG.md` → P2).
 */
export default function CatchAllLocale() {
  notFound();
}
