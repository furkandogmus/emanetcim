# BagajPark: Güvenlik ve Altyapı Protokolü

Platformun kimlik doğrulama, işlem güvenliği ve altyapı katmanlarının özeti. Ayrıntılı ve
güncel kaynaklar: sırlar `ops/SECRETS.md`, sunucu `ops/README.md`, altyapı
`infra/aws/README.md`, CI/CD `docs/CI_CD.md`. (Son doğrulama: 2026-11-23.)

---

## 1. Yazılım ve veri güvenliği

### 1.1. Kimlik doğrulama ve yetkilendirme
- **Web:** Auth.js v5 (`src/auth.config.ts`, `src/proxy.ts`) — e-posta/şifre, Google ve
  Apple ile giriş. Apple'da istemci sırrı sabit tutulmaz, sunucuda anahtardan
  (`APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_B64`, SSM'de) çalışma anında üretilir.
- **Mobil:** ayrı jose JWT (`src/lib/mobile-auth.ts`); iOS'ta Apple ile giriş. Web ve mobil
  oturumları karışmaz.
- **Roller:** misafir, esnaf (partner), admin. Kapılar `src/lib/action-auth.ts`
  (`requireAdmin` / `requirePartner`) ve mobil uçlarda `requireMobileUser`; action içinde
  elle rol kontrolü yazılmaz (`action-auth` mandal testi). Esnaf yalnızca kendi dükkanının
  kayıtlarını görür.
- Sosyal girişte parola tutulmaz; yalnızca sağlayıcının jetonları kullanılır.

### 1.2. QR kod ve işlem güvenliği
- **İmzalı QR:** rezervasyon QR'ı HS256 ile imzalı bir JWT'dir (`src/lib/qr-token.ts`).
  Süresi check-out + 24 saat, en az 48 saattir; ekran görüntüsü o süre boyunca geçerli
  kalır, yani QR tek başına kimlik kanıtı değil, rezervasyon referansıdır.
- **Mühür ve fotoğraf kanıtı:** teslimde valize numaralı plastik mühür atanır
  (`SealService.applyCheckInWithinTx`). Mühürlü valizin fotoğrafı istenir ama **zorunlu
  değildir** — kamerası çalışmayan esnafın valizi hiç teslim alamaması kanıt eksikliğinden
  daha kötü olduğu için. Fotoğraf adresi sunucuda üretilir; istemcinin gönderdiği adres
  kabul edilmez.

### 1.3. API güvenliği
- **Rate limit:** Redis tabanlı uygulama limitleri (`src/lib/rate-limit.ts`; giriş,
  rezervasyon, iletişim) ve nginx'te bölge limitleri (`nginx/conf.d/01-hardening.conf`).
- **Girdi doğrulama:** Zod şemaları (ör. mühür gövdesi `src/lib/seal-payload.ts`, web ve
  mobil aynı şema). SQL, Prisma'nın parametreli sorgularıyla kurulur.
- **Güvenlik başlıkları** (`next.config.ts`): HSTS, `X-Frame-Options: DENY`,
  `Cross-Origin-Opener-Policy: same-origin`, uygulanan bir CSP ve onun daha sıkı bir
  **Report-Only** sürümü; ihlaller `/api/csp-report`'a örneklemeyle loglanır.

---

## 2. Altyapı

### 2.1. Cloudflare
`bagajpark.com` Cloudflare arkasında (proxied): TLS, CDN, DDoS koruması ve WAF. Origin
sertifikası Cloudflare Origin Certificate'tir. EC2 güvenlik grubu 80/443'ü **yalnızca
Cloudflare aralıklarına** açar; origin IP'si repoya yazılmaz (`infra/aws/stack/main.tf`).

### 2.2. Sunucu ve veritabanı
- Tek AWS EC2 (eu-central-1) üzerinde Docker Compose: `web`, `postgres`, `redis`, `nginx`.
  Postgres dışarı açık değildir (`127.0.0.1:5433`).
- SSH varsayılan olmayan portta, yalnızca tanımlı bir CIDR'a açık; fail2ban kurulu.
- Deploy GitHub OIDC + SSM Run Command ile yapılır; CI'da ya da sunucuda statik AWS anahtarı
  yoktur.

### 2.3. Sırlar
Üretim sırları **AWS SSM Parameter Store**'da (SecureString). Sunucudaki
`docker-compose.env` her deploy'da oradan üretilir; elle düzenlenmez, git'e girmez. Sır
değerleri hiçbir komut çıktısına basılmaz (`ops/SECRETS.md`).

### 2.4. Yedek
Postgres 6 saatte bir `pg_dump` ile yedeklenir ve S3'e (sunucu dışına) kopyalanır
(`ops/README.md` § Yedek ve geri yükleme).

---

## 3. Açık maddeler

- [ ] Dış izleyici (`/api/health/live`, `/api/health/jobs`) — henüz kurulu değil
  (`docs/OBSERVABILITY.md`).
- [ ] CSP Report-Only ihlalleri değerlendirilip sıkı politika uygulamaya alınmalı.
- [ ] Yedeklerin geri yüklenebildiği düzenli olarak sınanmalı (son tam geri yükleme
  2026-10-25 hesap taşımasında).
