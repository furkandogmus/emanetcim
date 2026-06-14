# Üretim / prod-ready backlog

Bu liste **tamamlanmış işleri değil**, üretime yaklaşırken ve sonrasında sıraya alınabilecek **geniş kapsamlı** bir kontrol listesidir. Maddeler öncelik sırasına göre değil; ürün ve ekip ihtiyacına göre seçilip küçük PR’lara bölünmelidir.

---

## 1. Güvenlik ve uyumluluk

- [ ] **Secret yönetimi:** Production’da sadece vault / secret manager; rotasyon politikası; `.env` sızıntı taraması (git history dahil).
- [ ] **CSP / güvenlik başlıkları:** Nginx ve Next.js için tutarlı `Content-Security-Policy`, `HSTS`, `X-Frame-Options`, `Referrer-Policy`; raporlama endpoint’i.
- [ ] **Rate limiting:** Dağıtımlı limit (Redis/Upstash); kritik aksiyonlar (ödeme, giriş, şifre sıfırlama) için ayrı kotalar.
- [ ] **Auth hardening:** Session fixation, CSRF (form POST’lar), OAuth callback doğrulama, brute-force / account lockout politikası.
- [ ] **KVKK / GDPR:** Veri envanteri, saklama süreleri, silme/taşıma talepleri, DPA şablonları, alt işlemci listesi.
- [ ] **Denetim izi:** Admin ve finans işlemleri için immutable audit log (kim, ne, ne zaman, önceki değer).
- [ ] **Supply chain:** Bağımlılık güncellemeleri (Dependabot/Renovate), imzalı commit’ler, SBOM (Software Bill of Materials) çıktısı.
- [ ] **Şifreleme:** Veritabanı ve yedeklerde “at rest” şifreleme; transit TLS zorunluluğu; anahtar rotasyonu runbook’u.
- [ ] **Sınır güvenliği:** WAF / bot koruması; DDoS için CDN veya sağlayıcı katmanı; coğrafi kısıtlama ihtiyacı değerlendirmesi.

---

## 2. Finans, mutabakat ve muhasebe

- [ ] **Ledger tutarlılığı:** Çift kayıt / tek doğruluk kaynağı; günlük mutabakat job’ı; banka/ödeme sağlayıcı raporu ile karşılaştırma.
- [ ] **Para birimi ve yuvarlama:** Tüm tutarlar `Decimal` / minor unit; vergi ve komisyon kuralları tek yerde; yuvarlama hataları için test seti.
- [ ] **İade ve chargeback:** Durum makinesi; kısmi iade; webhook sonrası reconciliation; manuel düzeltme akışı (yetki + kayıt).
- [ ] **Fraud sinyalleri:** Anomali kuralları (hızlı ardışık rezervasyon, tutar eşiği); manuel inceleme kuyruğu.
- [ ] **Raporlama:** Günlük/aylık gelir, komisyon, iptal oranı; CSV/Excel export; vergi raporları için alanlar.
- [ ] **Muhasebe dönemleri:** Ay kapanışı; düzeltme kayıtları; denetçi/ERP export formatı (ihtiyaç halinde).
- [ ] **Çoklu para birimi (gerekirse):** Döviz kuru kaynağı; gösterim vs mutabakat para birimi; kur farkı kayıtları.

---

## 3. Veri, migrasyon ve bütünlük

- [ ] **Migration disiplini:** Geri alınamayan migration’lar için runbook; büyük tablo değişikliklerinde online migration stratejisi.
- [ ] **Yedekleme ve geri yükleme:** Postgres PITR veya günlük snapshot; geri yükleme tatbikatı (en az yılda bir).
- [ ] **Seed vs prod:** Seed verilerinin prod’a sızmasını engelleyen guard’lar; anonimleştirilmiş staging dump.
- [ ] **Soft delete / arşiv:** Kritik varlıklar için silme politikası; GDPR ile uyumlu kalıcı silme job’ı.
- [ ] **Okuma ölçeklemesi:** Read replica (rapor/analitik); bağlantı havuzu limitleri ve `statement_timeout`.
- [ ] **Veri kalitesi:** Benzersizlik kısıtları; periyodik tutarlılık kontrolleri (orphan kayıt, negatif bakiye uyarısı).

---

## 4. Güvenilirlik ve dayanıklılık

- [ ] **Idempotency:** Ödeme ve rezervasyon oluşturma için istemci/taraf anahtarı ile tekrarlanabilir istekler.
- [ ] **Kuyruk / outbox:** Kritik yan etkiler (e-posta, webhook, bildirim) için güvenilir teslimat ve yeniden deneme.
- [ ] **Timeout ve retry politikası:** Tüm HTTP çıkışları için net sınırlar; jitter’lı exponential backoff.
- [ ] **Ölü harf kuyruğu (DLQ):** İşlenemeyen mesajlar için inceleme ve yeniden oynatma; zehirli mesaj politikası.
- [ ] **Ön plan / arka plan ayrımı:** Uzun süren işleri HTTP isteğinden ayırma; kullanıcıya “işleniyor” durumu.

---

## 5. Gözlemlenebilirlik ve SRE

- [ ] **Structured logging:** İstek ID’si, kullanıcı/oturum korelasyonu; PII maskeleme.
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
- [ ] **Load test:** Beklenen eşzamanlı kullanıcı için senaryo; bottleneck raporu.
- [ ] **CDN:** Statik varlıklar ve uygunsa HTML için edge; cache invalidation politikası.
- [ ] **Dosya depolama:** Görseller için obje depolama (S3 uyumlu); imzalı URL; virüs taraması (yüklenen dosya varsa).

---

## 7. Ürün, UX ve erişilebilirlik

- [ ] **Mobil ve PWA:** Service worker stratejisi; offline davranışı; güncelleme bildirimi.
- [ ] **a11y:** Klavye navigasyonu, kontrast, ekran okuyucu etiketleri; kritik formlarda hata duyurusu.
- [ ] **Hata sayfaları:** 4xx/5xx için tutarlı mesaj ve geri dönüş yolları; destek iletişimi.
- [ ] **Çoklu dil:** Eksik anahtar tespiti; tarih/sayı yerelleştirmesi; RTL ihtiyacı değerlendirmesi.
- [ ] **Form ve doğrulama:** Telefon/ülke kodu, adres; hata mesajları erişilebilir ve tutarlı.
- [ ] **Karanlık mod / tema:** Tasarım token’ları ile tutarlı tema (ürün kararına bağlı).

---

## 8. Admin, operasyon ve destek

- [ ] **Platform ayarları:** Tüm iş kurallarının UI’dan yönetimi; değişiklik geçmişi ve geri alma.
- [ ] **Destek araçları:** Kullanıcı/rezervasyon arama; not ekleme; güvenli “impersonation” (varsa) denetimi.
- [ ] **Bakım modu:** Kontrollü read-only veya kapalı sayfa; health check ile koordinasyon.
- [ ] **Yetkilendirme matrisi:** Rol bazlı erişim (RBAC); ayrıcalık yükseltme (break-glass) prosedürü.
- [ ] **Operasyonel bayraklar:** Özellik aç/kapa (kill switch) acil durumda ödeme veya kayıt kapatmak için.

---

## 9. Test stratejisi

- [ ] **Piramit:** Unit → integration (DB) → e2e (kritik akışlar); flake azaltma ve paralel koşum.
- [ ] **Test verisi:** Deterministik factory’ler; prod benzeri anonim fixture’lar.
- [ ] **Görünürlük / a11y otomasyonu:** axe veya eşdeğeri ile kritik sayfalar; Lighthouse CI veya Core Web Vitals bütçesi.
- [ ] **Güvenlik testleri:** OWASP ZAP veya DAST (staging); bağımlılık tarama gate’i.

---

## 10. CI/CD ve sürüm

- [ ] **Kalite kapıları:** Lint, typecheck, test, build zorunlu; coverage eşiği (hedef netleştirme).
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
- [ ] **Sertifikalar ve DNS:** TLS yenileme; DNSSEC ihtiyacı; e-posta için SPF/DKIM/DMARC kayıtları.
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
- [ ] **Sözleşme sürümleri:** Kullanıcının hangi metni kabul ettiğinin kaydı; değişiklikte yeniden onay akışı.
- [ ] **Erişilebilirlik beyanı:** WCAG hedef seviyesi ve bilinen sınırlamalar (kamuya açık sayfa).

---

## 14. Alan modeli ve iş kuralları (domain)

- [ ] **Zaman dilimi:** Tüm tarih/saatlerin tek kaynak TZ ile saklanması; yaz saati geçişleri; “gün başı” tanımı.
- [ ] **Tatil ve çalışma saatleri:** Kapalı günlerde rezervasyon kuralı; işletme saatleri ile çakışma.
- [ ] **Fiyatlandırma kenar durumları:** Minimum/maksimum konaklama; dinamik fiyat (varsa) kuralları ve geriye dönük uyumluluk.
- [ ] **Çakışan rezervasyonlar:** Eşzamanlı taleplerde kilitleme veya optimistic concurrency stratejisi.
- [ ] **İptal pencereleri:** Kesinti oranının zamanına göre değişimi; istisna politikası (force majeure).

---

## 15. API, webhook ve dış entegrasyon

- [ ] **Sürümleme:** Public API varsa `/v1` ve deprecation politikası; breaking change duyurusu.
- [ ] **Giden webhook’lar:** Partner’a olay teslimi; imza, retry, idempotency anahtarı.
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

- [ ] **Kanal stratejisi:** E-posta, SMS, push (PWA); her biri için opt-in/opt-out ve yasal metin.
- [ ] **E-posta operasyonu:** Bounce ve şikayet yönetimi; baskı listesi; gönderim hızı limiti.
- [ ] **Şablon sürümü:** A/B veya çok dil; hata durumunda fallback metin.
- [ ] **Transactional vs pazarlama:** Ayrı izin ve farklı gönderim politikası (KVKK/GDPR).

---

## 18. Maliyet, kapasite ve optimizasyon

- [ ] **Bulut maliyet görünürlüğü:** Etiketleme (ortam, servis); aylık bütçe uyarısı.
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

İlgili mevcut dokümanlar: [Finans / ledger](FINANCE_LEDGER.md), [Gözlemlenebilirlik](OBSERVABILITY.md), [Platform ayarları](PLATFORM_SETTINGS.md), [Dal modeli](BRANCHING.md), [Prompt / AI geliştirme](PROMPT_GOVERNANCE.md).
