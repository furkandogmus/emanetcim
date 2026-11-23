# Güvenlik, kimlik doğrulama ve izleme

Sırlar `ops/SECRETS.md`, sunucu `ops/README.md`, altyapı `infra/aws/README.md`. Bu belge
2026-11-23'te eski `guvenlik_ve_altyapi_protokolu_tr.md`, `OAUTH.md` ve `OBSERVABILITY.md`'nin
yerine geçti.

**Son durum (2026-11-23):** yapılandırılmış log ve üç sağlık ucu var; **dış izleyici yok.**
Bedeli ölçüldü: 2026-10-25 → 11-23 arası cron işlerinin çoğu çalışmadı, `/api/health/jobs`
bunu 503 ile gösterdi ve kimse görmedi.

## 1. Kimlik doğrulama

| Giriş | Web (Auth.js v5, `src/auth.config.ts`) | Mobil (jose JWT, `src/lib/mobile-auth.ts`) |
|---|---|---|
| E-posta + şifre | açık | açık (sıfırlama kodu uygulamada girilir) |
| Google | açık | Android (iOS istemcisi tanımsız) |
| Apple | açık (Services ID `com.bagajpark.web`) | iOS (bundle `com.bagajpark`) |
| SMS kodu | kapalı | kapalı (`SMS_LOGIN_ENABLED`) |

Web ve mobil oturumlar ayrıdır. Roller `GUEST` / `PARTNER` / `ADMIN`; kapı
`src/lib/action-auth.ts`, mobilde `requireMobileUser` (her istekte rol, `isBanned`,
`tokenVersion` veritabanından okunur). Yönetici yükseltmesi dört göz onaylı.

**Google:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` web istemcisi; mobil token'ın kabul
edilen audience'ları `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`. Yetkili dönüş
adresleri `http://localhost:3000/api/auth/callback/google` ve
`https://bagajpark.com/api/auth/callback/google`.

**Apple:**

| Anahtar | Ne |
|---|---|
| `APPLE_ID` | Web Services ID (`com.bagajpark.web`); Return URL `https://bagajpark.com/api/auth/callback/apple` |
| `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_B64` | Sign in with Apple anahtarı ve base64 `.p8` içeriği (SSM) |
| `APPLE_TEAM_ID` | Varsayılan `524ZQ83Q42`; AASA da kullanır |
| `APPLE_BUNDLE_ID` | Mobil token audience'ı, varsayılan `com.bagajpark` |
| `APPLE_TOKEN_ENCRYPTION_KEY` | Apple refresh token'ını şifreleyen 32 bayt anahtar (`openssl rand -base64 32`, SSM). Boşsa token saklanmaz ve hesap silmede Apple yetkisi iptal edilemez (`AppleTokenService`) |
| `APPLE_SECRET` | Eski kurulum, doluysa önceliklidir; boş bırak |

İstemci sırrı en fazla 6 ay geçerli bir ES256 JWT'dir; elle üretilirse 6 ayda sessizce biter.
Bu yüzden süreç içinde anahtardan üretilir ve 30 günde bir yeniden imzalanır
(`src/lib/auth-providers.ts`); anahtar bozuksa Apple düğmesi gizlenir, sunucu düşmez. Apple
localhost kabul etmez. Yeni bir env anahtarı `docker-compose.yml` → `web.environment`'a da
yazılmazsa uygulamaya ulaşmaz.

**Demo girişleri** yalnızca `NEXT_PUBLIC_ENABLE_AUTH_DEMO=true` ile derlenen build'de görünür;
prod imajı bu bayrak olmadan derlenir.

## 2. Uygulama güvenliği

- **QR:** HS256 imzalı JWT (`src/lib/qr-token.ts`), check-out + 24 saat, en az 48 saat geçerli.
  Ekran görüntüsü o süre geçerli kalır: QR kimlik kanıtı değil, rezervasyon referansıdır.
- **Mühür:** teslimde numaralı mühür atanır (`SealService.applyCheckInWithinTx`). Fotoğraf
  isteğe bağlı (kamerası olmayan esnafın valizi hiç alamaması daha kötü); adresi sunucu üretir.
- **Rate limit:** Redis'li uygulama limitleri (`src/lib/rate-limit.ts`; giriş, rezervasyon,
  iletişim) ve nginx bölgeleri (`nginx/conf.d/01-hardening.conf`).
- **Girdi:** Zod şemaları (web ve mobil aynı, ör. `src/lib/seal-payload.ts`); SQL Prisma ile
  parametreli.
- **Başlıklar** (`next.config.ts`): HSTS, `X-Frame-Options: DENY`, COOP `same-origin`, uygulanan
  CSP ve daha sıkı bir Report-Only CSP; ihlaller `/api/csp-report`'a örneklemeyle loglanır.

## 3. Altyapı güvenliği

- `bagajpark.com` Cloudflare arkasında (TLS, CDN, DDoS, WAF); origin sertifikası Cloudflare
  Origin Certificate. EC2 güvenlik grubu 80/443'ü **yalnızca Cloudflare aralıklarına** açar;
  origin IP'si repoya yazılmaz.
- Postgres dışarı açık değil (`127.0.0.1:5433`). SSH varsayılan olmayan portta, tek CIDR'a açık,
  fail2ban kurulu.
- Deploy GitHub OIDC + SSM Run Command; CI'da ya da sunucuda statik AWS anahtarı yok.
- Sırlar SSM Parameter Store'da (SecureString); `docker-compose.env` her deploy'da oradan üretilir.
- Postgres 6 saatte bir `pg_dump` ile S3'e (`ops/README.md` § Yedek ve geri yükleme).

## 4. İzleme

**Log:** Pino (`src/lib/logger.ts`), üretimde JSON. Tutarlı alanlar: `bookingId`, `requestId`
(`src/proxy.ts`, `x-request-id` ya da yeni UUID), `err`, `service` (varsayılan `bagajpark`),
`env`, `version`. Anahtarlar: `request_error` (`instrumentation.ts`), iç işlerde `<iş>_failed`
(`generate_slots_failed`, `late_dropoff_scan_failed` …), `csp_report_only_violation`. Metrik
sistemi yok; tek kaynak `docker compose logs web`.

**Sağlık uçları:**

| Uç | Neye bakar | Sağlıksızsa |
|---|---|---|
| `/api/health/live` | Süreç ayakta mı (DB'ye dokunmaz) | — |
| `/api/health` | Postgres + Redis | `503` |
| `/api/health/jobs` | Zamanlanmış işler gerçekten çalışıyor mu | `503` |

`/api/health/jobs` ayrı çünkü slot üretimi 2026-07-14'te durdu ve 37 gün fark edilmedi; o süre
`/api/health` yeşildi. Altyapı sağlığı iş sağlığı değildir. Uç tazeliği ek kayıt tutmadan ölçer
(slot ufku günde 1 gün kısalır; 28 günün altı `503`), hiç aktif dükkan yoksa `not_applicable`
döner. **Bilerek herkese açık ve sırsız**: herhangi bir HTTP izleyici alarm verebilsin. Çağrı
başına ~18 sorgu koştuğu için kendi nginx limiti var: `api_health`, IP başına 12r/m,
`burst=6` (`location = /api/health/jobs`). `/api/health/live` limitsiz; nginx healthcheck'i onu
5 sn'de bir çağırır.

**Kurulacak izleme (açık iş, `docs/BACKLOG.md`):**

| Monitör | URL | Aralık |
|---|---|---|
| Ayakta mı | `https://bagajpark.com/api/health/live` | 1–5 dk |
| İşler çalışıyor mu | `https://bagajpark.com/api/health/jobs` | 30 dk (sinyal günlük ritimde değişir) |

İkisi de `503`'te alarm verir. UptimeRobot ücretsiz kademesi yeter; yanına `healthchecks.io`
tarzı "dead man's switch" konabilir. Limit doğrulaması: 10 ardışık `curl`'de ilk ~6 `200`,
kalanı `429` dönmeli.
