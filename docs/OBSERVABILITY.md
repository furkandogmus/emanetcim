# Observability (izlenebilirlik) — iki faz

Bu proje **Next.js App Router**, **Pino** (yapılandırılmış log) ve **health** uçları ile üretimde temel gözlemlenebilirlik sağlar. Kayıtlı kullanıcı sayısı değil; **hata oranı, gecikme ve bağımlılık sağlığı** önemlidir (ayrıntı: `docs/SCALING.md`).

---

## Faz 1 (~10k bandı, Bölüm 6 ile uyumlu) — şu an kodda

**Amaç:** Üretimde ne olduğunu görebilmek; sorun çıkınca log ve probe ile teşhis.

| Bileşen | Ne işe yarar |
|---------|----------------|
| **Pino** (`src/lib/logger.ts`) | JSON log (üretim), `service`, `env`, `version`; hassas alanlar **redact** |
| **`LOG_LEVEL`** | `info` (varsayılan), `debug` ile daha ayrıntılı (geçici) |
| **`APP_VERSION` / `VERCEL_GIT_COMMIT_SHA`** | Sürüm korelasyonu (deploy sonrası hangi commit) |
| **`x-request-id`** (`src/proxy.ts`, yalnızca `/api/*`) | İstek korelasyonu; yanıt başlığında da döner |
| **`getRequestLogger()`** (`src/lib/request-logger.ts`) | Route handler içinde `requestId` ile child logger |
| **`onRequestError`** (`instrumentation.ts`) | Sunucu hatalarında yapılandırılmış `request_error` logu |
| **`GET /api/health/live`** | **Liveness** — DB yok, süreç ayakta mı (sık probe için uygun) |
| **`GET /api/health`** | **Readiness** — `SELECT 1` ile Postgres |

### Operasyon notları

- **Log toplama:** stdout JSON’u **Docker log driver**, **systemd journal**, veya **Vercel log stream** ile harici sisteme (Loki, CloudWatch, Datadog agent, vb.) aktarın.
- **Uptime izleme:** Harici bir servis **readiness** (`/api/health`) ve isteğe bağlı **liveness** (`/api/health/live`) ile kontrol edebilir; readiness başarısızsa DB veya ağ sorunu arayın.
- **p95 / hata oranı:** Faz 1’de uygulama içi APM yok; Vercel Analytics / barındırıcı metrikleri veya log tabanlı paneller kullanılabilir.

---

## Faz 2 (ölçek / trafik arttığında) — henüz zorunlu değil

Aşağıdakiler **Bölüm 7** (ör. ~100k) veya metrik eşikleri (CPU, p95, pool tükenmesi) tetiklediğinde devreye alınır:

| Bileşen | Ne zaman |
|---------|----------|
| **APM** (Sentry, Datadog APM, Grafana Faro, OpenTelemetry + backend) | p95, dağılım, stack trace bir arada istenince |
| **Merkezi log + uyarı** (Loki+Alertmanager, Datadog Logs, vb.) | Log hacmi ve ekip büyüyünce |
| **Sentetik izleme / SLO** | Kritik akışlar (ödeme, webhook) için |
| **Postgres** `pg_stat_statements`, yavaş sorgu logu | DB darboğazı şüphesinde (SCALING’de anlatıldığı gibi) |

Faz 2’yi **Faz 1 metrikleri** (log hacmi, 5xx oranı, readiness başarısızlıkları) “artık yetersiz” dediğinizde planlayın; erken kurulum maliyeti ve karmaşıklık getirir.

---

## Ortam değişkenleri (özet)

| Değişken | Açıklama |
|----------|-----------|
| `LOG_LEVEL` | `trace` … `fatal` (varsayılan: `info`) |
| `APP_VERSION` | İsteğe bağlı sürüm etiketi (ör. `1.2.3`) |
| `VERCEL_GIT_COMMIT_SHA` | Vercel’de otomatik; log `version` alanına kısaltılmış yansır |

Tam liste: `.env.example`.
