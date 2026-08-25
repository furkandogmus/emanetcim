/**
 * Zamanlanmış işlerin TEK KAYIT DEFTERİ.
 *
 * NEDEN VAR (P1-11): iş tanımları üç ayrı yere dağılmıştı — `vercel.json`
 * (uygulamanın çalışmadığı bir platform), Hetzner crontab'ı (gerçek yürütücü) ve
 * hiç var olmayan işler. Hiçbiri diğerini bilmiyordu. Bu tek tek hataların değil,
 * **eksik bir kontrol düzleminin** sonucuydu ve iki kez ısırdı:
 *   - slot üretimi 37 gün durdu, kimse fark etmedi (P0-1)
 *   - ödeme mutabakat cron'u 2 ay boyunca 404 aldı, kimse fark etmedi (P1-1b)
 *
 * Artık tek kaynak burası. Buradan türeyenler:
 *   - `GET /api/health/jobs` — hangi iş gecikmiş, buradaki `maxStaleHours`'a göre
 *   - `scripts/emit-crontab.sh` — crontab satırları
 *   - `scripts/README.md` tablosu
 *
 * YENİ BİR İÇ İŞ EKLERKEN BURAYA DA EKLEYİN. `jobs-registry.test.ts` uç ile
 * kayıt defterinin ayrışmasını CI'da kırmızı yakar — yani unutmak mümkün değil.
 */

export type JobDefinition = {
  /** `/api/internal/<name>` yolu ve `JobRun.job` değeri. */
  readonly name: string;
  /** Ne yaptığı — tek cümle, operatöre yönelik. */
  readonly what: string;
  /**
   * Çalışmadığında ne olur. Bu alan bilerek zorunlu: gerekçesi yazılamayan bir iş
   * ya gereksizdir ya da kimse ne yaptığını bilmiyordur.
   */
  readonly ifItStops: string;
  /** Önerilen cron ifadesi (sunucu yerel saati). */
  readonly cron: string;
  /**
   * Son BAŞARILI çalışmanın üzerinden bu kadar saat geçtiyse iş gecikmiş sayılır.
   * Cron periyodunun ~2 katı olmalı: tek bir kaçırılmış çalışma alarm üretmesin,
   * ikincisi üretsin.
   */
  readonly maxStaleHours: number;
  /**
   * `false` ise gecikme sağlık kontrolünü DEGRADED yapmaz, yalnızca raporlanır.
   * Henüz cron'u kurulmamış işler için — kurulmamış bir iş "bozuk" değil,
   * "beklemede"dir ve kalıcı kırmızı, kimsenin bakmadığı bir kontrol demektir.
   */
  readonly enforced: boolean;
  /** Varsa ince sarmalayıcı script. */
  readonly script?: string;
};

export const JOB_REGISTRY: readonly JobDefinition[] = [
  {
    name: "generate-slots",
    what: "Aktif dükkanlar için 30 gün ileriye zaman slotu üretir.",
    ifItStops:
      "Saatlik ürün seçilemez hâle gelir (slot seçici boşalır) ve per-slot kapasite kontrolü yerini kaba, dükkan geneli bir kontrole bırakır. 2026-07-14'te oldu, 37 gün fark edilmedi.",
    cron: "17 4 * * *",
    maxStaleHours: 48,
    enforced: true,
    script: "scripts/generate-slots.sh",
  },
  {
    name: "overdue-scan",
    what: "Çıkış saatini geçtiği hâlde açık kalan rezervasyonları bulur ve olay yazar.",
    ifItStops:
      "Yaşam döngüsünün sonlanmayan ucu görünmez kalır. 19 rezervasyonun 18'i böyleydi ve üç müşterinin bavulu Haziran'dan beri 'dükkanda' görünüyordu.",
    cron: "47 4 * * *",
    maxStaleHours: 48,
    // Cron henüz kurulmadı — bkz. scripts/README.md 3. adım.
    enforced: false,
    script: "scripts/overdue-scan.sh",
  },
  {
    name: "booking-reminders",
    what: "Yaklaşan rezervasyonlar için misafire hatırlatma gönderir.",
    ifItStops: "Misafir check-in saatini kaçırır; no-show ve destek yükü artar.",
    cron: "7 9 * * *",
    maxStaleHours: 48,
    enforced: false,
  },
  {
    name: "cleanup",
    what: "Süresi geçmiş doğrulama token'larını, oturumları ve 90 günden eski analitik olaylarını siler.",
    ifItStops:
      "Tablolar sınırsız büyür — süresi geçmiş token'lar gereğinden uzun yaşar, AnalyticsEvent hiç küçülmez.",
    cron: "23 3 * * *",
    maxStaleHours: 72,
    enforced: false,
  },
  {
    name: "seal-forecast",
    what: "Dükkanların mühür ihtiyacını öngörür ve azalanları bildirir.",
    ifItStops:
      "Dükkanın mührü biter ve check-in yapılamaz; mühür tedariki 3 gün sürüyor.",
    cron: "37 6 * * 1",
    maxStaleHours: 24 * 9,
    enforced: false,
  },
  {
    name: "classify-inbox",
    what: "Sınıflandırılmamış gelen kutusu mesajlarını destek/toplu/otomatik olarak ayırır.",
    ifItStops:
      "Soğuk pazarlama destek kutusunu doldurur ve gerçek bir misafir şikâyeti aralarında kaybolur. 2026-08-22'de 67 mesajın 57'si okunmamıştı.",
    cron: "13 5 * * *",
    maxStaleHours: 48,
    enforced: false,
  },
  {
    name: "response-times",
    what: "Dükkanların 'yanıt süresi' rozetini geçmiş onay verisinden yeniden hesaplar.",
    ifItStops:
      "Rozet donar: dükkan yavaşlasa da eski hızlı sayıyı göstermeye devam eder. Çalışmadan hiç, `responseTimeMinutes` platform genelinde 0'dı ve rozet hiçbir ölçüme dayanmıyordu (P2-7).",
    cron: "29 3 * * *",
    maxStaleHours: 72,
    enforced: false,
  },
  {
    name: "finance-export",
    what: "Finans/mutabakat verisini dışa aktarır.",
    ifItStops: "Mutabakat elle yapılmak zorunda kalır.",
    cron: "53 2 * * *",
    maxStaleHours: 72,
    enforced: false,
  },
] as const;

export function findJob(name: string): JobDefinition | undefined {
  return JOB_REGISTRY.find((j) => j.name === name);
}

/** Cron'u kurulmuş ve gecikmesi alarm üretmesi gereken işler. */
export function enforcedJobs(): readonly JobDefinition[] {
  return JOB_REGISTRY.filter((j) => j.enforced);
}
