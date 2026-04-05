# Veritabanı yedek ve geri yükleme

Kullanıcı ve iş verisi **PostgreSQL** içindedir (`docker-compose.yml` → `postgres_data` volume). Bu repo, **`pg_dump` / `pg_restore`** ile tam yedek ve geri yükleme script’leri sağlar.

Statik dosyalar **`public/`** altında (Nginx volume); büyük kullanıcı yüklemesi yoksa yedek çoğunlukla DB ile yeterlidir. İsterseniz `INCLUDE_PUBLIC=1` ile `public/` da arşivlenir.

## Gereksinimler

- Sunucuda veya geliştirici makinede **Docker Compose** ile aynı proje dizini (`docker-compose.yml` mevcut).
- `postgres` servisi ayakta olabilmeli (`docker compose up -d postgres`).

## Yedek alma

```bash
cd /opt/emanetci   # veya repo kökünüz
chmod +x scripts/backup.sh scripts/restore.sh   # ilk sefer
./scripts/backup.sh
```

- Çıktı: `backups/emanetci_YYYYMMDD_HHMMSS.dump` (özel format, `pg_restore` ile uyumlu).
- `docker-compose.env` varsa otomatik kullanılır (`COMPOSE_ENV` ile değiştirebilirsiniz).

### `public/` dahil etmek

```bash
INCLUDE_PUBLIC=1 ./scripts/backup.sh
```

Ek dosya: `backups/emanetci_YYYYMMDD_HHMMSS_public.tar.gz`

### Yedek dizinini değiştirmek

```bash
BACKUP_DIR=/var/backups/emanetci ./scripts/backup.sh
```

## Geri yükleme

**Uyarı:** Mevcut `emanetci` veritabanındaki nesneler, yedekteki şema ile uyumlu olacak şekilde `pg_restore --clean --if-exists` ile silinir ve yedek içeriği yüklenir. Kısa süre **`web`** servisi durdurulur.

```bash
./scripts/restore.sh /opt/emanetci/backups/emanetci_20250101_120000.dump
```

Onaysız (ör. cron veya otomasyon):

```bash
FORCE=1 ./scripts/restore.sh ./backups/emanetci_xxx.dump
```

Sonra kontrol: `curl -s http://127.0.0.1/api/health/live`

## Otomatik yedek (cron örneği)

Her gün 03:00’te:

```cron
0 3 * * * cd /opt/emanetci && /opt/emanetci/scripts/backup.sh >> /var/log/emanetci-backup.log 2>&1
```

Eski dosyaları silmek için (ör. 14 günden eski):

```cron
15 3 * * * find /opt/emanetci/backups -name 'emanetci_*.dump' -mtime +14 -delete
```

## Uzak kopya

Yedek dosyalarını **sunucu dışında** da tutun (başka disk, S3, başka makine `rsync`/`scp`). Tek kopya disk arızasında kaybolur.

## Sık sorunlar

| Durum | Not |
|-------|-----|
| `pg_restore` uyarıları | `EXTENSION` veya sahip farkı uyarıları görülebilir; kritik hata yoksa normal. |
| `connection refused` | `docker compose ps` — `postgres` çalışıyor mu? |
| Geri yükleme sonrası migration | Tam dump kullanılıyorsa Prisma şeması veriyle birlikte gelir; `prisma migrate deploy` genelde gerekmez. |

## İlgili dosyalar

- `scripts/backup.sh` — yedek
- `scripts/restore.sh` — geri yükleme
- `docker-compose.yml` — `postgres_data` volume
