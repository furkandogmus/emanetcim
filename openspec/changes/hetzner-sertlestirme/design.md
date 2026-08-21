## Context

Sunucu 21.08.2026'da salt-okunur denetlendi (bkz. sohbet geçmişi / bu proposal'ın `Why`
bölümü). Uygulama katmanı (Next.js, Prisma, Pino logger, CI'daki lint/typecheck/test)
sağlam; eksik olan sunucu çevresindeki operasyonel disiplin. Gerçek müşteri/esnaf verisi
henüz yok — bu, geri dönüşü olmayan hata riskini düşürüyor ama "zaten kimse kullanmıyor"
gerekçesiyle güvenlik açıklarını (334k brute-force denemesi, tek kopya backup) ertelemek
doğru değil; canlıya geçildiğinde bu katman zaten oturmuş olmalı.

## Goals / Non-Goals

**Goals:**
- fail2ban'ı gerçek SSH portuna (12022) bağlamak, cron'daki token'ı güvenli hale getirmek
- Deploy'u tek, öngörülebilir bir yola indirmek (`main` → GitHub Actions)
- Backup'ı disk-arızası-öldürmez hale getirmek (offsite + retention)
- Log büyümesini sınırlamak, temel uptime görünürlüğü kazanmak

**Non-Goals:**
- Kubernetes / multi-node yüksek erişilebilirlik (tek VPS, tek müşteri kitlesi henüz yok —
  gereksiz karmaşıklık)
- Tam Prometheus/Grafana/Loki stack'i (RAM sıkışık, 620MB boş; `docs/OBSERVABILITY.md`'nin
  önerdiği ağır stack yerine hafif Uptime Kuma yeterli)
- IaC ile Hetzner sunucusunun kendisini yönetmek (tek, elle kurulmuş VPS; yeniden
  kurulacaksa zaten `[[aws-paralel-ortam]]` Terraform pratiği bu deneyimi verecek)

## Decisions

### 1. Deploy: sadece `main` → prod
**Karar**: `crontab -u root`'tan `*/5 * * * * .../update.sh` satırını kaldır (dosyayı
silmiyoruz, elle tetiklenebilir bir araç olarak dursun). Tek deploy yolu
`.github/workflows/deploy.yml` (push → `main`).
**Neden**: `docs/BRANCHING.md` zaten bunu tanımlıyor; cron bunu 5 dakikada bir eziyordu.
Kullanıcı bu modeli seçti (2026-08-21).
**Sonuç**: `develop`'a merge artık prod'u etkilemiyor; yayın için `develop → main` PR'ı
gerekiyor — release ritmi hafif yavaşlıyor, karşılığında prod'a yarı-bitmiş kod gitmiyor.
**Yan düzeltme**: `ops/server.env`'de `SSH_KEY_PATH=~/.ssh/bagajpark_ops_ed25519` yazıyor
ama gerçek key `~/.ssh/hetzner` — ya key'i konvansiyona uygun isimle yeniden üretip
sunucudaki `authorized_keys`'i güncelle, ya da `server.env`'i gerçek yola göre düzelt (ikinci
seçenek daha az riskli, tercih edilen). `scripts/vm-update.sh` varsayılan dizini
(`/opt/emanetci`) gerçek yolla (`/root/emanetci`) tutarlı hale getir — `APP_DIR` env
değişkeni zaten doğru, script varsayılanı yanıltıcı.

### 2. fail2ban port düzeltmesi
**Karar**: `/etc/fail2ban/jail.local`'da `[sshd]` bölümüne `port = 12022` ekle (mevcut
`port = ssh` satırının üzerine), `systemctl restart fail2ban`, ardından
`fail2ban-client status sshd` ile aktif jail'in doğru portu izlediğini doğrula.
**Neden**: 74 günlük pencerede 334.166 başarısız deneme port 12022'ye geldi, ban kuralları
ise (gerçekte kapalı olan) port 22'yi hedefliyordu — fiilen koruma yoktu.
**Doğrulama**: değişiklikten sonra `fail2ban-client status sshd` çıktısında port/jail
eşleşmesini ve `Currently banned` sayısının gerçekçi şekilde artmaya başladığını izle.

### 3. Cron token → `.env`
**Karar**: `reconcile-payments` / `seal-forecast` cron satırlarındaki plaintext Bearer
token'ı kaldır, `CRON_SECRET`'ı `.env`'e taşı, script'in `source .env` ile okumasını sağla,
token'ı rotate et (eski değer zaten crontab'da açıkta durduğu için sızmış sayılır).
**Neden**: `crontab -l` veya `/var/spool/cron/root`'u okuyabilen herkes token'ı görüyordu.

### 4. Offsite backup: AWS S3
**Karar**: `scripts/backup.sh`'a (veya ayrı bir `scripts/backup-offsite.sh`'a) dump
alındıktan sonra `aws s3 cp` ile ayrı, kalıcı bir S3 bucket'a push adımı ekle. Bu bucket
`[[aws-paralel-ortam]]` değişikliğinde oluşturulacak ama **onun Terraform yaşam döngüsünden
bağımsız** tutulacak — deneysel AWS ortamı `terraform destroy` edilse bile backup bucket'ı
sağ kalmalı.
**Neden**: Kullanıcı S3'ü offsite hedef olarak onayladı (2026-08-21); Hetzner + S3 aynı
sağlayıcıya bağımlı olmadığından tek nokta arızası ortadan kalkıyor.
**Retention**: `find "$BACKUP_DIR" -name 'emanetci_*.dump' -mtime +14 -delete` cron'a
eklenecek (şu an `docs/BACKUP.md`'de örnek olarak yazılı ama sunucuda fiilen çalışmıyor).
0-byte dump'lar (ilk başarısız çalıştırmalardan kalan 2 dosya) manuel temizlenecek.

### 5. Log rotasyonu
**Karar**: `/etc/logrotate.d/emanetci` — `update.log`, `backup.log`, `reconcile.log`,
`cleanup.log`, `seal-forecast.log` için `daily`, `rotate 14`, `compress`, `missingok`,
`notifempty`.
**Neden**: `update.log` 18MB'a çıktı, hiçbiri rotate edilmiyordu. Docker'ın kendi json-log
limitleri (`max-size`/`max-file`, `docker-compose.yml`'de zaten doğru) bu dosyaları
kapsamıyor çünkü onlar container dışı, düz cron çıktıları.

### 6. Uptime Kuma
**Karar**: `docker-compose.yml`'e (ya da ayrı bir `docker-compose.monitoring.yml`'e)
`louislam/uptime-kuma` container'ı ekle, `bagajpark.com` + `/api/health/live` + Postgres
container health'i için monitör tanımla, Telegram bot üzerinden alert.
**Neden**: Kullanıcı hafif self-hosted seçeneği onayladı (2026-08-21); ~150MB RAM, 620MB
boşta bu sığıyor ama swap kullanımını (şu an 797MB/2GB) izlemeye devam etmek gerekiyor.
**Alternatif (reddedildi)**: Tam Prometheus/Grafana/Loki — RAM bütçesine göre orantısız.

## Risks / Trade-offs

- Cron `update.sh`'ı kapatmak → hotfix'ler artık anında `develop`'tan sunucuya gitmiyor;
  acil düzeltme gerektiğinde `docs/BRANCHING.md`'deki hotfix akışı (`main`'den
  `hotfix/...` → PR → `main`) kullanılmalı. Bu daha yavaş ama kontrollü.
- fail2ban restart'ı SSH bağlantısını kesmez (sadece jail servisi), ama uygulamadan önce
  **aktif bir SSH oturumu açık tutarak** test edilmeli — kilitlenme riski düşük ama sıfır
  değil.
- S3 push adımı `backup.sh`'a yeni bir dış bağımlılık (AWS CLI + credential) ekliyor; script
  bu adımda başarısız olursa yerel dump'ın alınması engellenmemeli (S3 adımı ayrı, hataya
  toleranslı bir sonraki adım olarak eklenecek).

## Migration Plan

Faz sırası `tasks.md`'de. Her faz kendi başına geri alınabilir (fail2ban config eski haline
`jail.local.bak` ile döner, cron satırı yorum satırına alınarak kapatılır — silinmez).
