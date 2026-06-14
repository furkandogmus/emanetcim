# Ölçekleme ve dağıtım: Self-hosted vs Vercel


---

## 1. Self-hosted (kendi sunucunuz / VPS / Kubernetes)

### Mimari özeti

| Katman | Tipik seçim |
|--------|-------------|
| Uygulama | `node .next/standalone` veya `next start`, **birden fazla process/replica** |
| Reverse proxy | Nginx, Caddy, Traefik (TLS, gzip, rate limit) |
| Veritabanı | Aynı makinede veya ayrı **managed Postgres** (RDS, DigitalOcean, Neon, vb.) |
| Oturum | JWT ile stateless; **sticky session gerekmez** |

### Artıları

- **Uzun süreli işler** (büyük rapor, toplu export) teknik olarak daha rahat.
- **WebSocket / SSE** veya uzun süren bağlantılar sorunsuz.
- Postgres’e **doğrudan bağlantı**; Prisma pool’u kontrol sizde.
- Maliyet, trafik sabitlendiğinde **Vercel’e göre öngörülebilir** olabilir.

### Eksileri / yükü

- TLS, yama, yedekleme, izleme, log retention **sizin sorumluluğunuz**.
- Trafik artınca **load balancer + N replica** kurmanız gerekir.

### Ölçekleme sırası (öneri)

1. **PostgreSQL**: CPU / disk / bağlantı sayısı izleyin; `pg_stat_statements` ile yavaş sorgular.
2. **Connection pooling**: Uygulama replica sayısı arttıkça toplam bağlantı patlar; **PgBouncer** (transaction mode) veya managed pool.
3. **Uygulama**: Aynı imajdan **N container** (Docker Compose / K8s Deployment), health check ile.
4. **Read replica** (okuma ağırlıklı dashboard’lar için) — ihtiyaç oldukça.
5. **Redis + kuyruk** (webhook, e-posta, SMS yoğunluğu) — ihtiyaç oldukça.

### Ortam değişkenleri

- `DATABASE_URL` (pooler’a işaret edebilir)
- `AUTH_SECRET`, `AUTH_URL` (dış domain)

**Docker Compose** ile aynı stack’i tek sunucuda denemek için: **`docs/DOCKER.md`** (Postgres + Next + **Nginx** reverse proxy).

---

## 2. Vercel (veya benzeri serverless)

### Mimari özeti

| Katman | Tipik seçim |
|--------|-------------|
| Uygulama | **Serverless** fonksiyonlar (her istek ayrı süre sınırı) |
| Veritabanı | **Mutlaka** network üzerinden erişilebilir Postgres; **connection pool** şart |
| Edge | Middleware, statik içerik, CDN — iyi |

### Artıları

- **Otomatik ölçek** (cold start maliyeti hariç trafik dalgalanmasına uyum).
- TLS, CDN, dağıtım kolaylığı.
- Edge middleware ile **locale**, auth yönlendirme uygun.

### Eksileri / dikkat

- **Süre limiti**: Uzun süren işler (büyük rapor, toplu CSV) **serverless içinde** riskli; **background job** (Vercel Cron + external worker, veya harici kuyruk) düşünün.
- **WebSocket**: Sunucu tarafında kalıcı bağlantı için genelde **ayrı host** (ör. self-hosted socket) veya managed realtime.
- **Prisma + serverless**: Her invocation’da yeni bağlantı açmak DB’yi boğar → **Prisma Accelerate**, **PgBouncer**, veya **Neon** gibi serverless-dostu Postgres + pool zorunlu sayılır.
- **Dosya yükleme**: Kalıcı disk yok; **S3 / R2 / Cloudinary** gibi object storage.

### Ölçekleme sırası (öneri)

1. **PostgreSQL**: Managed + **connection pooling** (Accelerate veya pooler URL).
2. **Vercel planı**: Function duration / concurrency limiti; aşılırsa işleri kuyruğa alın.
3. **Edge cache** / ISR: Sık okunan public sayfalar.
4. **Read replica** (okuma Prisma ile) — sorgu yükü yüksekse.

### Ortam

- `DATABASE_URL` → **pooled** connection string
- `AUTH_URL` = production URL (Auth.js)
- Webhook’lar için sabit, herkese açık bir URL (Vercel domain)

---

## 3. Karşılaştırma (kısa)

| Konu | Self-hosted | Vercel |
|------|-------------|--------|
| Operasyon yükü | Yüksek | Düşük |
| Öngörülebilir maliyet (yüksek trafik) | Kolay modelleme | Kullanım + function limit’e bağlı |
| DB bağlantısı | Doğrudan kontrol | Pool / Accelerate kritik |
| Uzun iş / cron | Rahat | Limit + harici worker |
| Ölçek (yatay) | LB + N replica | Otomatik (limitler içinde) |

---

## 4. Bu projeye özel notlar

- **Auth**: JWT; çok instance’da **sticky session gerekmez**.
- **Proxy** (`src/proxy.ts`): Vercel edge veya self-hosted’ta reverse proxy ile uyumlu; `matcher` ve locale prefix’leri koruyun.

---

## 5. Pratik öneri

- **MVP / erken aşama**: Vercel + managed Postgres (pool) → hızlı çıkış.
- **Kontrol ve maliyet optimizasyonu**: Trafik ve operasyon ekibi büyüyünce **self-hosted** veya **hibrit** (Vercel + ayrı worker sunucusu) düşünülebilir.

Somut “kaç kullanıcı” rakamı için **load test** (ör. k6) ve **production benzeri** DB boyutu şarttır; mimari olarak iki yol da bu stack ile ölçeklenebilir.

---

## 6. Örnek hedef: ~10.000 misafir + ~1.000 esnaf + 5 admin

### Önemli ayrım

Buradaki **10.000 / 1.000** rakamları **kayıtlı hesap / dükkan sayısı** (tablo satırı) anlamındadır. Sunucuyu zorlayan şey bu değil; **aynı anda gelen istek (eşzamanlılık)** ve **saniyedeki istek (RPS)**.

Kabaca:

| Kavram | Ne anlama gelir |
|--------|------------------|
| 10.000 kayıtlı misafir | Veritabanında ~10k `User` (GUEST) — **disk ve indeks** için hafif |
| 1.000 esnaf | ~1k `Shop` + sahipleri — yine **veri hacmi** küçük-orta |
| 5 admin | İhmal edilebilir yük |

**Eşzamanlı kullanıcı** genelde toplamın küçük bir kesiti: tipik tüketici uygulamasında gün içi zirvede **yüzlerce** eşzamanlı oturum bile “yoğun” sayılabilir; 10.000 kişinin hepsinin aynı anda tıklaması gerçekçi değil.

Aşağıdaki boyutlandırma, **orta seviye pazarlama trafiği** (ani viral yok) ve **harita + arama + ödeme** akışı için **başlangıç üretim** bandıdır; zirve için **load test** ile doğrulayın.

### Veritabanı (PostgreSQL)

- **Boyut**: On binlerce kullanıcı + rezervasyonlar çoğu projede **birkaç GB** altında kalır; asıl maliyet **sorgu ve bağlantı**.
- **Önerilen başlangıç (managed Postgres)**:
  - **2 vCPU, 4–8 GB RAM**, SSD, otomatik yedek
  - Bağlantı limiti **~100–200** sunucu tarafında; uygulama tarafında **PgBouncer** veya sağlayıcının **pool URL**’si
- **Prisma pool** (örnek): `connection_limit` uygulama başına **5–15** (replica sayısı × pool ≤ Postgres limitinin altında kalmalı).

**1.000 esnaf** için `Shop` listesi / harita sorgularında **coğrafi indeks** (`latitude`, `longitude`) ve `isActive` filtreleri önemli; aksi halde CPU artar (kod tarafı optimizasyonu).

### Uygulama katmanı

**Self-hosted örnek (tek bölge):**

| Bileşen | Makul başlangıç |
|---------|-----------------|
| Next.js | **2×** replica (ör. 2 vCPU / 4 GB RAM her biri) veya **1×** 4 vCPU |
| Reverse proxy | Nginx / Caddy, TLS, rate limit |
| (İsteğe bağlı) Redis | Oturum değil (JWT var); **cache** veya **kuyruk** için sonradan |

**Vercel örnek:**

| Bileşen | Makul başlangıç |
|---------|-----------------|
| Plan | **Pro** (üretim, daha yüksek limit) |
| Postgres | **Neon / Supabase / RDS** küçük-orta tier + **pooled** `DATABASE_URL` |
| Prisma | **Accelerate** veya mutlaka pool; serverless’ta doğrudan DB bağlantısından kaçının |

### Bant genişliği ve dış servisler

- **Webhook**: Kısa cevap + idempotent iş; yoğunlukta **kuyruk** (ileride).

### 5 admin

İdari panel sorguları düşük hacim; **5 kullanıcı** için ayrı donanım gerekmez.

### Özet tablo (bu hedef için)

| Senaryo | Kabaca yön |
|---------|------------|
| **Self-hosted** | 1 küçük **DB** (2 vCPU, 4–8 GB) + pool + **2 app** node veya 1 güçlü node; monitörle büyütün |
| **Vercel** | **Pro** + **managed Postgres (pool)**; gerekirse DB bir kademe büyütülür |

### Ne zaman yukarı çıkılır?

- Postgres **CPU sürekli %70+**, disk I/O yüksek
- **Connection** hataları (pool tükendi)
- **p95 yanıt süresi** hedefin üzerinde (APM ile)

Bu durumda sırayla: **sorgu optimizasyonu → pool ayarı → DB instance büyütme → app replica → read replica**.

Bu ölçek (**~10k + ~1k esnaf**) için başlangıçta **aşırı büyük cluster** genelde gereksiz; **ölçülebilir tek üretim hattı + izleme + yedek** daha doğru yatırım.

---

## 7. Örnek hedef: ~100.000 misafir + ~10.000 esnaf (üretim bandı)

Bu bölüm, **Bölüm 6’daki mantığın bir üst kademesi**dir: kayıtlı kullanıcı sayısı büyüdükçe **veri tabanı satırı** ve **depolama** artar; ama **ani yük** yine **eşzamanlı istek** ile belirlenir. 100k seviyesinde aşağıdakiler **sıradan** hale gelir:

- Daha fazla **rezervasyon / ödeme kaydı** (tablo büyümesi, yedek süresi).
- Daha **sık tam tarama** riski (yavaş sorgular).
- Pazarlama kampanyasında **kısa süreli trafik sıçraması** (peak RPS).

Aşağıdaki öneriler, **sürekli orta–yüksek trafik** ve **haftalık kampanya** gibi senaryolara göre **tutarlı bir üretim bandı**dır; kesin rakam için **k6 / benzeri load test** ile doğrulama şarttır.

### Varsayılan ölçek (örnek)

| Rol | Kabaca kayıt |
|-----|----------------|
| Misafir | ~100.000 |
| Esnaf (dükkan) | ~10.000 (Bölüm 6’daki 10:1 oranı korunuyorsa) |
| Admin | Birkaç–onlar (ihmal edilebilir) |

### Veritabanı (PostgreSQL) — 100k bandı

| Konu | Öneri |
|------|--------|
| **Instance** | **4–8 vCPU**, **16–32 GB RAM**, hızlı SSD; managed tercih (RDS, Cloud SQL, Neon büyük tier, vb.) |
| **Bağlantı** | **PgBouncer** (transaction mode) veya sağlayıcı **pool**; toplam uygulama bağlantısı **Postgres `max_connections`** altında kalmalı |
| **Okuma** | Raporlama / arama yoğunsa **read replica** (okuma Prisma ile) düşünün |
| **Veri** | Eski **rezervasyonlar** için **partitioning** (aylık/yıllık) veya arşiv tablosu — tablo milyon satıra yaklaşınca |
| **İndeks** | `Shop` (konum, `isActive`), `Booking` (`guestId`, `shopId`, `status`, `createdAt`) — üretimde `EXPLAIN` ile doğrulayın |

**100k kullanıcı** tek başına **disk**’i çoğu zaman **onlarca GB** bandında tutar; risk **büyüyen `Booking` / `PaymentLog`** ve **rapor sorguları**.

### Uygulama katmanı

**Self-hosted (önerilen çerçeve):**

| Bileşen | 100k bandı |
|---------|------------|
| Next.js | **4–8** replica (ör. 2 vCPU / 4 GB veya eşdeğeri) veya **LB arkasında 2–4 güçlü node** |
| Load balancer | **Health check**, **graceful shutdown**, isteğe bağlı **rate limit** (edge veya Nginx) |
| **Redis** | **Cache** (harita / popüler listeler), **rate limit**, **kuyruk** (webhook, e-posta) — bu bantta **güçlü tavsiye** |
| Arka plan iş | **Ayrı worker** (aynı Docker imajı, farklı `CMD`: kuyruk tüketicisi) — uzun rapor / toplu iş |

**Vercel:**

| Bileşen | 100k bandı |
|---------|------------|
| Plan | **Pro** ile başlanır; **sürekli yüksek concurrency** ve **uzun işler** birikirse **Enterprise** veya **hibrit** (aşağıda) |
| DB | **Büyük managed Postgres** + **pool**; **Prisma Accelerate** veya eşdeğeri |
| Hibrit | Ağır işler (CSV, raporlar) için **küçük bir worker** (Railway, Fly, kendi VPS) + kuyruk |

### Önbellek ve CDN

- **Statik** + **ISR** mümkün sayfalar: edge / CDN ile origin yükünü düşürün.
- **API yanıtları** (ör. yakındaki dükkanlar): kısa TTL **Redis** (ör. 30–120 sn) ile DB’yi koruyun.

### Ödeme ve webhook

- Webhook başına iş **idempotent**; yoğunlukta **kuyruk + worker** (Redis + BullMQ / benzeri) **100k bandında planlanabilir**.

### İzleme ve operasyon

| Araç | Amaç |
|------|------|
| APM (Datadog, Grafana Cloud, vb.) | p95/p99, hata oranı |
| Postgres | **Yavaş sorgu logu**, `pg_stat_statements` |
| Uyarı | CPU, bağlantı, disk, kuyruk derinliği |

### Özet: 10k → 100k farkı (tek bakış)

| Alan | ~10k bandı (Bölüm 6) | ~100k bandı (Bölüm 7) |
|------|---------------------|---------------------|
| Postgres | 2 vCPU, 4–8 GB | 4–8 vCPU, 16–32 GB; replica / partition |
| App node | 1–2 replica | **4–8** replica veya eşdeğer CPU |
| Redis | İsteğe bağlı | **Önerilir** (cache + kuyruk) |
| Worker | Genelde yok | **Rapor / webhook** için mantıklı |
| Maliyet | Düşük–orta | **Belirgin şekilde** daha yüksek (özellikle DB + trafik) |

### Son not

**100.000 kayıtlı kullanıcı** hedefi, **tek seferde** bu donanıma geçmek zorunda değildir; **ölçülebilir** yol: **Bölüm 6** ile başlayıp metrikler (CPU, p95, pool) **eşik aşınca** Bölüm 7’deki parçaları sırayla eklemek (önce DB + pool, sonra **Redis**, sonra **replica worker**).

Kesin donanım seçimi için **üretim benzeri** ortamda **load test** ve **maliyet** tablosu (aylık DB + app + CDN) çıkarın.

---

## 8. Observability (izlenebilirlik)

**~10k bandı** için uygulama tarafında yapılandırılmış log, istek kimliği, sağlık uçları ve sunucu `onRequestError` kancası yeterli bir **Faz 1** başlangıcıdır. **~100k / yüksek trafik** için APM, merkezi log uyarıları ve DB içi metrikler **Faz 2** olarak ayrı planlanır.

Ayrıntılı iki fazlı anlatım: **`docs/OBSERVABILITY.md`**.
