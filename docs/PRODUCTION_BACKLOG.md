# Üretim / prod-ready backlog

Bu liste **stratejik dilek listesidir**: üretime yaklaşırken ve sonrasında sıraya
alınabilecek geniş kapsamlı maddeler. Kanıtlı hatalar burada değil,
`docs/DEFECT_BACKLOG.md`'de. Eski `V2_ROADMAP.md` ve `STRATEGIC_INTEGRATIONS.md`
2026-11-23'te en alttaki "Ürün yol haritası" bölümüne katıldı.

## Son durum — 2026-11-23

- İşaretler koda karşı yeniden doğrulandı; `[x]` kodda var, `[~]` kısmen, `[ ]` yok.
- Sürüyor (birleşmedi): ortaklık programı (PR #207), anlık dükkan slotları ve esnaf
  adayı dönüşümü (PR #208).
- En büyük açık kalem online ödeme: PSP adaptörü + webhook ucu (§ 15, `docs/PAYMENTS.md`).

---

## 1. Güvenlik ve uyumluluk

- [x] **Secret yönetimi:** 2026-08-29 tamamlandı. Sırlar AWS SSM Parameter Store’da
  (`ops/SECRETS.md`); deploy env dosyasını her seferinde oradan üretir. Postgres
  parolası döndürüldü. Git history sızıntı taraması yapıldı ve `docker_logs_500.txt`
  geçmişten çıkarıldı. Kalan: rotasyonun **takvime** bağlanması (şu an elle).
- [x] **CSP / güvenlik başlıkları:** `next.config.ts`'te HSTS, `X-Frame-Options`, `Referrer-Policy`, COOP ve CSP; sıkı CSP `Report-Only` + `/api/csp-report` (2026-11-23). Kalan: Report-Only'den zorunluya geçiş.
- [x] **Rate limiting:** Redis'li dağıtık limit (`src/lib/rate-limit.ts`, `REQUIRE_DISTRIBUTED_RATE_LIMIT` varsayılan açık); girişte kimlik ve IP için iki ayrı kova.
- [ ] **Auth hardening:** Session fixation, CSRF (form POST’lar), OAuth callback doğrulama, brute-force / account lockout politikası.
- [ ] **KVKK / GDPR:** Veri envanteri, saklama süreleri, silme/taşıma talepleri, DPA şablonları, alt işlemci listesi.
- [x] **Denetim izi:** `AuditLog` (`AuditLogService`); web `/admin/audit-log` ve mobil "Denetim kaydı". Rol değişikliği dört göz onaylı.
- [~] **Supply chain:** CI'da bağımlılık denetimi (`npm run audit`). Kalan: Dependabot/Renovate, imzalı commit, SBOM.
- [ ] **Şifreleme:** Veritabanı ve yedeklerde “at rest” şifreleme; transit TLS zorunluluğu; anahtar rotasyonu runbook’u.
- [ ] **Sınır güvenliği:** WAF / bot koruması; DDoS için CDN veya sağlayıcı katmanı; coğrafi kısıtlama ihtiyacı değerlendirmesi.

---

## 2. Finans, mutabakat ve muhasebe

- [ ] **Ledger tutarlılığı:** Çift kayıt / tek doğruluk kaynağı; günlük mutabakat job’ı; banka/ödeme sağlayıcı raporu ile karşılaştırma.
- [~] **Para birimi ve yuvarlama:** Kısmen. Tutarlar `Decimal`, komisyon kuralı tek
  yerde (`PlatformSettings.platformCommissionRate` + `src/lib/platform-split.ts`),
  yuvarlama test seti var (`platformCommission + merchantAmount === grossAmount`).
  Kalan: **KDV**. Komisyon faturası KDV dahil mi hariç mi, `PaymentSplit` üzerinde
  oran enstantanesi tutulacak mı — karar verilmedi.
- [ ] **İade ve chargeback:** Durum makinesi; kısmi iade; webhook sonrası reconciliation; manuel düzeltme akışı (yetki + kayıt).
- [ ] **Fraud sinyalleri:** Anomali kuralları (hızlı ardışık rezervasyon, tutar eşiği); manuel inceleme kuyruğu.
- [ ] **Raporlama:** Günlük/aylık gelir, komisyon, iptal oranı; CSV/Excel export; vergi raporları için alanlar.
- [ ] **Muhasebe dönemleri:** Ay kapanışı; düzeltme kayıtları; denetçi/ERP export formatı (ihtiyaç halinde).
- [ ] **Çoklu para birimi (gerekirse):** Döviz kuru kaynağı; gösterim vs mutabakat para birimi; kur farkı kayıtları.

---

## 3. Veri, migrasyon ve bütünlük

- [ ] **Migration disiplini:** Geri alınamayan migration’lar için runbook; büyük tablo değişikliklerinde online migration stratejisi.
- [~] **Yedekleme ve geri yükleme:** 6 saatte bir S3'e `pg_dump` (`scripts/backup-s3.sh`); geri yükleme `ops/README.md`. Kalan: PITR ve takvimli tatbikat.
- [~] **Seed vs prod:** `seed-guard` seed'i prod'a karşı çalıştırmaz. Kalan: anonim staging dump.
- [ ] **Soft delete / arşiv:** Kritik varlıklar için silme politikası; GDPR ile uyumlu kalıcı silme job’ı.
- [ ] **Okuma ölçeklemesi:** Read replica (rapor/analitik); bağlantı havuzu limitleri ve `statement_timeout`.
- [x] **Veri kalitesi:** günlük `consistency-check` işi, mühür envanteri denetimi (`SealIntegrityService`), süre aşımı taraması (`overdue-scan`).

---

## 4. Güvenilirlik ve dayanıklılık

- [ ] **Idempotency:** Ödeme ve rezervasyon oluşturma için istemci/taraf anahtarı ile tekrarlanabilir istekler.
- [ ] **Kuyruk / outbox:** Kritik yan etkiler (e-posta, webhook, bildirim) için güvenilir teslimat ve yeniden deneme.
- [ ] **Timeout ve retry politikası:** Tüm HTTP çıkışları için net sınırlar; jitter’lı exponential backoff.
- [ ] **Ölü harf kuyruğu (DLQ):** İşlenemeyen mesajlar için inceleme ve yeniden oynatma; zehirli mesaj politikası.
- [ ] **Ön plan / arka plan ayrımı:** Uzun süren işleri HTTP isteğinden ayırma; kullanıcıya “işleniyor” durumu.

---

## 5. Gözlemlenebilirlik ve SRE

- [~] **Structured logging:** `docs/OBSERVABILITY.md`. Kalan: uçtan uca PII maskeleme denetimi.
- [ ] **Metrikler:** HTTP latency, hata oranı, kuyruk derinliği, ödeme başarı oranı, DB bağlantı havuzu.
- [ ] **Alerting:** SLO tanımları; uyarı gürültüsü azaltma; on-call runbook’ları.
- [ ] **Distributed tracing:** OpenTelemetry ile uçtan uca iz (en azından kritik akışlar).
- [ ] **Synthetic monitoring:** Kritik URL’ler için dışarıdan ping; SSL süresi uyarısı.
- [ ] **Error budget:** Release hızı ile stabilite arasında bilinçli denge; hata bütçesi tükenince feature freeze kuralı.
- [ ] **Postmortem kültürü:** Sev-1/2 olaylar için köksüz analiz; aksiyon maddeleri takibi.

---

## 6. Performans ve ölçek

- [ ] **DB sorguları:** N+1 taraması; yavaş sorgu log’u; gerekli indeksler ve `EXPLAIN` kontrolleri.
- [ ] **Önbellek:** Okuma ağırlıklı listeler için Redis/cache; invalidation stratejisi.
- [ ] **Next.js:** Image optimization, bundle analizi, dinamik import; edge uygunluğu değerlendirmesi.
- [~] **Load test:** `tests/stress/` (k6, Artillery) ve `scripts/load-test.k6.js`. Kalan: düzenli koşum ve rapor.
- [ ] **CDN:** Statik varlıklar ve uygunsa HTML için edge; cache invalidation politikası.
- [~] **Dosya depolama:** dükkan görselleri S3'te (`src/lib/storage/`), tip doğrulamalı. Kalan: virüs taraması.

---

## 7. Ürün, UX ve erişilebilirlik

- [ ] **Mobil ve PWA:** Service worker stratejisi; offline davranışı; güncelleme bildirimi.
- [ ] **a11y:** Klavye navigasyonu, kontrast, ekran okuyucu etiketleri; kritik formlarda hata duyurusu.
- [x] **Hata sayfaları:** `[locale]/error.tsx`, `not-found.tsx`; ham hata metni mandalı (`raw-error-copy`).
- [ ] **Çoklu dil:** Eksik anahtar tespiti; tarih/sayı yerelleştirmesi; RTL ihtiyacı değerlendirmesi.
- [ ] **Form ve doğrulama:** Telefon/ülke kodu, adres; hata mesajları erişilebilir ve tutarlı.
- [ ] **Karanlık mod / tema:** Tasarım token’ları ile tutarlı tema (ürün kararına bağlı).

---

## 8. Admin, operasyon ve destek

- [~] **Platform ayarları:** web + mobil yönetimi, her değişiklik `AuditLog`'da (`docs/PLATFORM_SETTINGS.md`). Kalan: tek tıkla geri alma.
- [~] **Destek araçları:** yönetici kullanıcı ve rezervasyon araması, mesajlar, itirazlar (web + mobil). Impersonation yok.
- [ ] **Bakım modu:** Kontrollü read-only veya kapalı sayfa; health check ile koordinasyon.
- [x] **Yetkilendirme matrisi:** `GUEST`/`PARTNER`/`ADMIN`, kapı `src/lib/action-auth.ts`; yönetici yükseltmesi dört göz onaylı, son yönetici düşürülemez.
- [x] **Operasyonel bayraklar:** `FeatureFlag` (yüzde ve izin listesiyle, web + mobil yönetim); ödeme anahtarı `PAYMENT_PROVIDER`.

---

## 9. Test stratejisi

- [ ] **Piramit:** Unit → integration (DB) → e2e (kritik akışlar); flake azaltma ve paralel koşum.
- [ ] **Test verisi:** Deterministik factory’ler; prod benzeri anonim fixture’lar.
- [ ] **Görünürlük / a11y otomasyonu:** axe veya eşdeğeri ile kritik sayfalar; Lighthouse CI veya Core Web Vitals bütçesi.
- [ ] **Güvenlik testleri:** OWASP ZAP veya DAST (staging); bağımlılık tarama gate’i.

---

## 10. CI/CD ve sürüm

- [~] **Kalite kapıları:** typecheck, lint, test, e2e, build CI'da zorunlu ve deploy'a bağlı (`docs/CI_CD.md`). Kalan: coverage eşiği.
- [ ] **Güvenlik taraması:** `npm audit`, SAST (CodeQL veya eşdeğeri), bağımlılık güncelleme politikası.
- [ ] **Ortam promosyonu:** staging → prod checklist; migration sırası; feature flag stratejisi.
- [ ] **Rollback:** Deploy geri alma prosedürü; veritabanı geri sarma sınırları dokümante.
- [ ] **Canary / aşamalı yayın:** Yüzde bazlı trafik veya ortam sırası; otomatik geri alma kriterleri.
- [ ] **Ortam paritesi:** Staging’in prod’a yakınlığı (versiyon, feature flag, örnek veri politikası).

---

## 11. Altyapı ve DevOps

- [ ] **Docker / orchestration:** Kaynak limitleri; healthcheck’ler; sıfır kesinti deploy (blue-green veya rolling).
- [ ] **Gizli ve yapılandırma:** Ortam bazlı config; secrets as env / mounted files.
- [ ] **Ağ:** Private DB; firewall kuralları; VPN veya bastion erişimi.
- [~] **Sertifikalar ve DNS:** TLS `scripts/tls-put.sh`; `bagajpark.com` kökünde SPF. Kalan: DMARC politikası, DNSSEC değerlendirmesi.
- [ ] **Kapasite planlama:** Disk doluluk uyarısı; log rotasyonu; büyük tablo büyüme projeksiyonu.

---

## 12. Dokümantasyon ve ekip

- [ ] **Runbook’lar:** Incident response, ödeme kesintisi, veritabanı doluluğu.
- [ ] **Onboarding:** Yerel kurulum, ortam değişkenleri, sık hatalar.
- [ ] **API / entegrasyon:** Partner veya mobil istemci için sözleşme dokümanı (varsa).
- [ ] **Güvenlik açığı süreci:** HackerOne veya security@ iletişim; SLO ile yanıt süresi; CVE triage.

---

## 13. Yasal ve içerik

- [ ] **Statik sayfalar:** KVKK, sözleşme, iletişim bilgileri; güncelleme tarihi ve sürüm.
- [ ] **E-posta şablonları:** İptal, ödeme onayı, hatırlatma; spam ve DMARC/SPF/DKIM.
- [~] **Sözleşme sürümleri:** kabul kaydı `LegalAcceptance`'ta. Kalan: metin değişince yeniden onay akışı.
- [ ] **Erişilebilirlik beyanı:** WCAG hedef seviyesi ve bilinen sınırlamalar (kamuya açık sayfa).

---

## 14. Alan modeli ve iş kuralları (domain)

- [x] **Zaman dilimi:** UTC saklama, gösterim platform/dükkan diliminde; `timeZone` mandal testi (2026-11-22).
- [x] **Tatil ve çalışma saatleri:** `platformHolidayDates`, `ShopWeeklyHours`, `ShopClosure`; check-in toleransı `checkInGraceMin`.
- [ ] **Fiyatlandırma kenar durumları:** Minimum/maksimum konaklama; dinamik fiyat (varsa) kuralları ve geriye dönük uyumluluk.
- [x] **Çakışan rezervasyonlar:** slot kapasite kilidi (`ReservationSlot`), iptal/check-in yarışında koşullu yazım ve `bookingRowVersion`.
- [ ] **İptal pencereleri:** Kesinti oranının zamanına göre değişimi; istisna politikası (force majeure).

---

## 15. API, webhook ve dış entegrasyon

- [ ] **Sürümleme:** Public API varsa `/v1` ve deprecation politikası; breaking change duyurusu.
- [ ] **Giden webhook’lar:** Partner’a olay teslimi; imza, retry, idempotency anahtarı.
- [ ] **Gelen ödeme webhook’u (`/api/webhooks/payments/[provider]`):** Sözleşme HAZIR,
  HTTP ucu yok. `PaymentProvider.verifyWebhook()` ve `NormalizedPaymentEvent`
  (`src/lib/payments/types.ts`) tanımlı; eksik olan ucun kendisi.
  Yazarken: (a) imza doğrulaması `JSON.parse`’tan **önce ham gövde** üzerinde
  yapılır — Next.js gövdeyi otomatik ayrıştırırsa imza tutmaz; (b) `verified:false`
  dönen isteğe **asla** defter işlemi uygulanmaz; (c) aynı olayın iki kez gelmesi
  ikinci bir tahsilat üretmemeli — `PaymentLog.idempotencyKey` bunun için var.
  **Bilinçli olarak sağlayıcı seçimine bırakıldı:** doğrulayacağı imzanın şeklini
  bilmeden yazılan uç, PSP belli olunca büyük ihtimalle ikinci kez yazılır.
  Bağlam: `docs/PAYMENTS.md` → “Pazaryeri katmanı”.
- [ ] **Sandbox–prod paritesi:** Test ortamında üretimle aynı kod yolu; mock seviyesi dokümante.

---

## 16. Analitik, SEO ve büyüme

- [ ] **Ürün analitiği:** Dönüşüm hunisi (arama → rezervasyon → ödeme); funnel kopma noktaları.
- [ ] **Gizlilik dostu ölçüm:** Çerez onayı olmadan toplanamayan veriler; anonimleştirilmiş event şeması.
- [x] **SEO (temel):** `sitemap.xml` ve `robots.txt` (App Router); taban URL: `NEXT_PUBLIC_BASE_URL` veya `NEXT_PUBLIC_APP_URL`.
- [ ] **SEO (ileri):** `meta`/canonical tutarlılığı; yapılandırılmış veri (işletme/rezervasyon); Open Graph / Twitter Card.
- [ ] **Kırık link / 404:** Ölü URL izleme; yönlendirme stratejisi (eski permalink’ler).

---

## 17. Bildirimler ve iletişim kanalları

- [~] **Kanal stratejisi:** e-posta, web push ve mobil push açık; SMS kapalı (`docs/URUN_VE_IS_KURALLARI.md` § Bildirimler). Kalan: kanal başına opt-out.
- [ ] **E-posta operasyonu:** Bounce ve şikayet yönetimi; baskı listesi; gönderim hızı limiti. (`/api/webhooks/resend` yalnızca gelen postayı işler.)
- [ ] **Şablon sürümü:** A/B veya çok dil; hata durumunda fallback metin.
- [ ] **Transactional vs pazarlama:** Ayrı izin ve farklı gönderim politikası (KVKK/GDPR).

---

## 18. Maliyet, kapasite ve optimizasyon

- [~] **Bulut maliyet görünürlüğü:** AWS bütçe alarmı kodda (`infra/aws/bootstrap/budget.tf`), `scripts/aws-cost-report.sh`. Kalan: etiketleme düzeni.
- [ ] **Veritabanı maliyeti:** Büyük sorguları ve indeks boyutunu izleme; soğuk veri arşivleme (ihtiyaç halinde).
- [ ] **Build ve CI süresi:** Cache stratejisi; gereksiz job’ları ayırma; maliyet/latency trade-off.

---

## 19. Felaket kurtarma ve iş sürekliliği

- [ ] **RTO / RPO hedefleri:** Ne kadar süre down kalınabilir, ne kadar veri kaybı kabul edilir — yazılı runbook.
- [ ] **Çoklu bölge (gerekirse):** Okuma için replica; felakette DNS failover veya manuel geçiş prosedürü.
- [ ] **Kritik satıcı kesintisi:** Ödeme sağlayıcı veya e-posta down senaryosu; kullanıcı mesajı ve iç süreç.

---

## 20. Çok kiracılılık, ortak ve sınırlar

- [ ] **Veri izolasyonu:** Partner/mağaza verisinin yanlışlıkla başka kiracıya sızmasını önleyen sorgu kalıpları ve testler.
- [ ] **Kota ve kötüye kullanım:** Mağaza başına API veya kayıt limiti; kötü niyetli bot tespiti.
- [ ] **Beyaz etiket / marka:** Ortak domain veya alt domain politikası; SSL ve marka kılavuzu.

---

## 21. Gizlilik, çerez ve pazarlama izinleri

- [x] **Çerez banner’ı (v1):** Zorunlu vs analitik tercihi; `localStorage` + `emanetci:cookie-consent` olayı; KVKK/Gizlilik linkleri. *(İleri: ayrı tercih merkezi sayfası, pazarlama pikselleri.)*
- [ ] **Pazarlama pikselleri:** Yalnızca onay sonrası yükleme; Meta/Google etiket yönetimi.
- [ ] **Veri dışa aktarma:** KVKK kapsamında makine okunur export; silme talebi SLA’sı.

---

## 22. Tasarım sistemi ve tutarlılık

- [ ] **Bileşen kütüphanesi:** Tekrarlayan UI kalıplarının soyutlanması; Storybook veya eşdeğeri (ekip büyüklüğüne göre).
- [ ] **Tasarım token’ları:** Renk, spacing, tipografi; tema ve marka güncellemelerinde tek kaynak.
- [ ] **Durum göstergeleri:** Yükleme, boş liste, hata; tüm listelerde tutarlı empty state.

---

## 23. Tedarik zinciri ve üçüncü taraflar

- [ ] **Yedek sağlayıcı stratejisi:** Kritik entegrasyon için B planı (manuel süreç veya alternatif).
- [ ] **Lisans uyumu:** NPM paketlerinin lisans uyumluluğu; copyleft risk analizi (kurumsal gereksinim halinde).

---

## 24. Kalite bütçeleri ve regresyon önleme

- [ ] **Core Web Vitals:** LCP/INP/CLS için eşikler; CI’da veya periyodik ölçüm.
- [ ] **Bundle bütçesi:** Ana chunk boyutu üst sınırı; gereksiz bağımlılık temizliği.
- [ ] **Görsel regresyon (opsiyonel):** Kritik sayfalar için screenshot diff (Percy/Chromatic vb.).

---

## Nasıl kullanılır

1. Her sprint/hafta bir veya birkaç madde seçin; tek PR’da çok kategori karıştırmayın.
2. Tamamlanan maddeleri işaretleyin veya alt başlık altında “Done / tarih” notu düşün.
3. Ürün önceliği değişince bu dosyayı güncelleyin; “hepsi şart” değildir.

İlgili mevcut dokümanlar: [Ödeme ve finans](PAYMENTS.md), [Gözlemlenebilirlik](OBSERVABILITY.md), [Platform ayarları](PLATFORM_SETTINGS.md), [Dal modeli](GIT_COMMIT_GUIDE.md), [Prompt / AI geliştirme](PROMPT_GOVERNANCE.md).

---

## 25. Ürün yol haritası (eski V2_ROADMAP + STRATEGIC_INTEGRATIONS)

Durumlar 2026-11-23'te koda göre işaretlendi.

**Yapılanlar**

- [x] `FeatureFlag` modeli ve yönetimi (web `/admin/feature-flags`, mobil).
- [x] `BookingEvent` (yalnız eklenen olay günlüğü).
- [x] Hatırlatmalar: `booking-reminders`, valizi kalan misafire hatırlatma, geç bırakma taraması (`scripts/README.md`).
- [x] Esnaf paneli: kazanç özeti, sunucu tarafı rezervasyon araması, QR afişi; mobil esnaf panosu.
- [x] Erişilebilirlik: modal ve form etiket mandalları, alan düzeyi hatalar, `inert` arka plan.
- [x] Davet indirimi (`ReferralService`), kupon ve kampanya ekranları.
- [x] Yasal kabul izi (`LegalAcceptance`).
- [x] Native uygulama: Expo (`mobile-expo/`), push, derin bağlantılar (`/app`, AASA, assetlinks).

**Sürenler**

- [ ] Ortaklık (affiliate) programı: kampanya kodları ve komisyon raporu — PR #207, birleşmedi.
- [ ] Anlık dükkan slotları ve esnaf adayı dönüşümü — PR #208, birleşmedi.

**Açık fikirler**

- [ ] Güvenilirlik rozetleri (doğrulanmış dükkan, yanıt süresi; `response-times` işi veriyi hesaplıyor).
- [ ] Bildirim tercih merkezi, esnaf "sessiz saat"i.
- [ ] Toplu fiyat / kapasite düzenleme, esnaf içi yardım.
- [ ] Performans bütçesi (LCP/INP) CI'da.
- [ ] Çok para birimi gösterimi.
- [ ] OTA / otel kanalı: ortak API anahtarı, imzalı giden webhook (`booking.created`, `booking.checked_out`), IP allowlist.
- [ ] Sigorta ortağı: harici poliçe referansı (`Booking.externalPolicyRef`, migrasyon gerekir).
