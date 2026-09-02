/**
 * Uyuşmazlık durumları — TEK KAYNAK.
 *
 * NEDEN AYRI DOSYA (2026-09-02): `Dispute.status` şemada `String`, Prisma
 * enum'u değil. Dolayısıyla izin verilen değerler kodda elle yazılıyordu ve
 * ÜÇ AYRI YERDE tekrarlanıyordu:
 *
 *   - `actions/dispute.ts`            -> zod enum (yazma kapısı)
 *   - `components/admin/AdminDisputesClient.tsx` -> STATUS_OPTIONS (admin seçimi)
 *   - `bookings/[id]/dispute/page.tsx` -> switch (misafire gösterilen etiket)
 *
 * Bugün üçü de aynı; bu bir tesadüf, kural değil. Bir değer eklenip diğer iki
 * yer güncellenmediğinde ortaya çıkacak hata sessiz olur: admin yeni durumu
 * seçer, misafir onu "Açık" olarak görür (switch'in `default` dalı) ya da yazma
 * kapısı isteği reddeder. Bu oturumda aynı sınıfın beş ayrı örneği bulundu --
 * hakediş statüleri, saat dilimi, dil listesi, kupon alanı, adres alanları --
 * ve hepsi "iki yerden biri eksik kalmış" haliyle çıktı.
 *
 * `as const` + `DisputeStatus` tipi, üç yerin de aynı listeden türemesini
 * sağlıyor; yeni bir değer eklendiğinde derleyici eksik kalan yeri gösterir.
 */
export const DISPUTE_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** Yeni açılan uyuşmazlığın durumu. */
export const DISPUTE_INITIAL_STATUS: DisputeStatus = "OPEN";
