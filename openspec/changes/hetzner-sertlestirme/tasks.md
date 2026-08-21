## 0. Acil Güvenlik (aynı gün)

- [ ] 0.1 `/etc/fail2ban/jail.local` → `[sshd]` bölümüne `port = 12022` ekle
- [ ] 0.2 `systemctl restart fail2ban` + `fail2ban-client status sshd` ile doğrula
- [ ] 0.3 Aktif SSH oturumunu kapatmadan yeni bir terminalden bağlantıyı test et
- [ ] 0.4 Cron'daki plaintext `CRON_SECRET`/Bearer token'ı `.env`'e taşı, script'i
      `source .env` okuyacak şekilde güncelle
- [ ] 0.5 Token'ı rotate et (eski değeri geçersiz kıl)
- [ ] 0.6 `dnf check-update --security` çıktısındaki paketleri gözden geçir,
      `dnf update --security` (bakım penceresinde, önce `docker compose ps` ile servis
      sağlığını kontrol et)

## 1. Deploy Tek Doğruluk Kaynağı

- [ ] 1.1 `crontab -u root -e` → `update.sh` satırını yorum satırına al (silme)
- [ ] 1.2 24 saat gözlemle: `develop`'a yeni commit gelse de sunucu değişmemeli
- [ ] 1.3 `main`'e test amaçlı küçük bir değişiklik push et, `deploy.yml`'in gerçekten
      `/root/emanetci`'yi güncelleyip `docker compose up -d --no-build` çalıştırdığını
      doğrula
- [ ] 1.4 `ops/server.env`'de `SSH_KEY_PATH` değerini gerçek key yoluna (`~/.ssh/hetzner`)
      göre düzelt (ya da key'i `~/.ssh/bagajpark_ops_ed25519` olarak yeniden adlandır —
      hangisi seçilirse `ops/README.md`'yi de güncelle)
- [ ] 1.5 `scripts/vm-update.sh` varsayılan `APP_DIR`'ı `/root/emanetci` yap
- [ ] 1.6 `docs/VM-LAN.md` ve `docs/BACKUP.md`'deki `/opt/emanetci` referanslarını gerçek
      yolla tutarlı hale getir (ya da açıkça "örnek yol" olduğunu not et)

## 2. Backup Sağlamlaştırma

> **2026-08-21 karar**: Şu an sunucudaki veri dummy/test verisi (gerçek müşteri/esnaf yok),
> offsite kopya otomasyonu şimdilik öncelik değil. `hetzner-backup-writer` IAM kullanıcısı
> ve scoped S3 policy'si zaten hazır (`aws-paralel-ortam` bootstrap'ındaki
> `bagajpark-backups-43403243` bucket'ına sadece `PutObject`/`ListBucket`). **Gerçek veri
> gelince** 2.3'teki adım aktifleştirilecek — o zamana kadar bu faz beklemede.

- [ ] 2.1 Sunucudaki 2 adet 0-byte dump dosyasını temizle
- [ ] 2.2 Cron'a retention satırı ekle: `find $BACKUP_DIR -name 'emanetci_*.dump' -mtime
      +14 -delete`
- [ ] 2.3 IAM kullanıcısı / S3 bucket hazır olduğunda (bkz. `[[aws-paralel-ortam]]` Faz 0-1)
      `scripts/backup.sh`'a `aws s3 cp "$BACKUP_DIR/${NAME}.dump" "s3://<bucket>/pg/"
      adımını ekle (best-effort — S3 hatası yerel dump'ı geçersiz kılmamalı)
- [ ] 2.4 Bir manuel restore denemesi yap (S3'ten indirilen bir dump ile, ayrı/geçici bir
      Postgres konteynerinde) — "yedek var" ile "yedek geri yüklenebilir" farklı şeyler
- [ ] 2.5 `docs/BACKUP.md`'nin "Uzak kopya" bölümünü gerçek S3 komutlarıyla güncelle

## 3. Log Hijyeni

- [ ] 3.1 `/etc/logrotate.d/emanetci` oluştur (`update.log`, `backup.log`,
      `reconcile.log`, `cleanup.log`, `seal-forecast.log` — `daily`, `rotate 14`,
      `compress`, `missingok`, `notifempty`)
- [ ] 3.2 `logrotate -d /etc/logrotate.d/emanetci` (dry-run) ile doğrula
- [ ] 3.3 Mevcut 18MB'lık `update.log`'u elle bir kereliğine sıkıştır/arşivle

## 4. Hafif Gözlemlenebilirlik

- [ ] 4.1 `uptime-kuma` container'ı ekle (ayrı compose dosyası veya mevcut dosyaya yeni
      servis), disk/RAM etkisini `docker stats` ile doğrula
- [ ] 4.2 Monitörler: `https://bagajpark.com/api/health/live`, Postgres/Redis container
      health, disk kullanım eşiği
- [ ] 4.3 Telegram bot oluştur, Uptime Kuma notification olarak bağla
- [ ] 4.4 Bir monitörü kasıtlı kırıp (örn. container'ı durdurup) alertin gerçekten geldiğini
      doğrula, sonra geri aç

## 5. Nice-to-have (opsiyonel, sıra beklemez)

- [ ] 5.1 `dnf-automatic` (sadece `--security`) timer'ı aktive et
- [ ] 5.2 fail2ban `bantime`/`findtime`'ı gözden geçir (334k deneme sonrası mevcut süre
      yetersiz kalmış olabilir)
- [ ] 5.3 RAM/swap için basit bir eşik alarmı (Uptime Kuma "push" monitör + küçük bir
      shell script ile) ekle
