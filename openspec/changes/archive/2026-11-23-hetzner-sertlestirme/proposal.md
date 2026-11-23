## Why

Canlı sunucu (`178.104.144.3:12022`, `/root/emanetci`) 21.08.2026 tarihli bir denetimde
incelendi. Uygulama 2 aydır sağlıklı çalışıyor ama etrafındaki operasyonel katman (deploy,
backup, log, güvenlik izleme) hiç sertleştirilmemiş durumda ve üç somut, aktif risk taşıyor:

1. **fail2ban yanlış portu koruyor.** sshd `12022`'de dinliyor, fail2ban'daki sshd jail'i
   `port = ssh` (yani 22) kullanıyor — 74 günde **334.166 başarısız SSH denemesi** kayıtlı,
   gerçek port fiilen korumasız.
2. **İki deploy mekanizması aynı dizini çekiştiriyor.** Cron (`*/5 * * * *`) `develop`'u,
   GitHub Actions `main`'e push'ta ayrı bir deploy'u tetikliyor — `docs/BRANCHING.md`'nin
   "main = prod" niyetiyle çelişiyor, hangisi son çalışırsa o branch prod'da kalıyor.
3. **Tek kopya backup + iki güvenlik açığı daha:** offsite kopya yok (159MB, 523 dosya, hepsi
   aynı disk), cron içinde plaintext bearer token, ~20 bekleyen security paketi.

## What Changes

1. **Güvenlik (acil)** — fail2ban jail'ini `12022`'ye düzelt, cron'daki plaintext token'ı
   `.env`'e taşı + rotate et, `dnf update --security`.
2. **Deploy tek doğruluk kaynağı** — cron'daki `update.sh`'ı kapat, sadece `main` push →
   GitHub Actions `deploy.yml` prod'a dokunsun (`docs/BRANCHING.md` ile hizalı). `ops/`
   ve `scripts/vm-update.sh` içindeki yol/isim tutarsızlıklarını düzelt.
3. **Backup sağlamlaştırma** — retention (`+14 gün` sil), 0-byte dosya temizliği, offsite
   kopya (AWS S3, `[[aws-paralel-ortam]]` ile paylaşılan ama ondan bağımsız yaşayan bir
   bucket).
4. **Log hijyeni** — `update.log` (18MB, sınırsız büyüyor) ve kardeşleri için logrotate.
5. **Hafif gözlemlenebilirlik** — Uptime Kuma (self-hosted, ~150MB RAM) ile uptime +
   healthcheck izleme, Telegram/Discord alert.

## Capabilities

### New Capabilities
- `deploy-single-source`: Tek branch (`main`) → tek deploy yolu (GitHub Actions), cron
  tabanlı ikinci bir deploy mekanizması yok
- `offsite-backup`: Postgres dump'ları sunucu dışına (S3) otomatik kopyalanıyor, retention
  ile yönetiliyor
- `uptime-monitoring`: Uptime Kuma ile dışa açık healthcheck izleme + alert

### Modified Capabilities
- `ssh-hardening`: fail2ban artık gerçek SSH portunu koruyor
- `secrets-handling`: cron'daki plaintext token `.env`'e taşındı ve rotate edildi
- `log-retention`: uygulama logları (update/backup/reconcile/cleanup/seal-forecast) rotate
  ediliyor

## Impact

- **Sunucu**: `/etc/fail2ban/jail.local`, `crontab -u root`, `/etc/logrotate.d/emanetci`,
  yeni `uptime-kuma` container
- **Repo**: `.github/workflows/deploy.yml` (değişmez, tek doğruluk kaynağı olur),
  `scripts/backup.sh` (S3 push adımı), `ops/README.md`, `ops/server.env.example`,
  `scripts/vm-update.sh` (varsayılan yol düzeltmesi)
- **Docs**: `docs/BACKUP.md` (offsite bölümü güncellenecek), `docs/VM-LAN.md` (yol
  tutarlılığı)
