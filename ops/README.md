# ops/ — canlı sunucunun işletimi

Canlı sunucu: AWS EC2, `eu-central-1`, kullanıcı `ec2-user`, SSH portu `2222`, uygulama
dizini `/opt/emanetci`. Hesap, Terraform, kurulum ve taşıma geçmişi: [`infra/aws/README.md`](../infra/aws/README.md).
Yerel Docker kullanımı:
[`docs/GELISTIRME.md`](../docs/GELISTIRME.md).

(2026-11-23: eski `docs/BACKUP.md` bu dosyanın "Yedek ve geri yükleme" bölümüne katıldı.)

## Dizindeki dosyalar

| Dosya | Ne |
|---|---|
| `server.env.example` | SSH erişim şablonu. Gerçek `ops/server.env` git'e girmez (`.gitignore`) ve bu makineden çıkmaz |
| `crontab.prod` | Sunucunun `ec2-user` crontab'ının repodaki kopyası (`scripts/README.md`) |
| `secrets.manifest` | Deploy'da `docker-compose.env` üretilirken zorunlu tutulan anahtar adları |
| `SECRETS.md` | Üretim sırları — SSM Parameter Store akışı |

## Deploy

Sunucuya normalde elle girilmez. `main`'e merge → `.github/workflows/ci.yml` → doğrulama
∥ GHCR imajı → `deploy` job'ı (GitHub OIDC + SSM Run Command). Deploy `docker-compose.yml`,
`public/`, `scripts/`, `nginx/conf.d/` ve `ops/secrets.manifest`'i S3 üzerinden
`/opt/emanetci`'ye taşır, `docker-compose.env`'i SSM'den yeniden üretir
(`scripts/secrets-render.sh`) ve `docker compose up -d` çalıştırır. Ayrıntı: [`docs/GELISTIRME.md`](../docs/GELISTIRME.md).

CI kullanılamıyorsa sunucuda elle: `cd /opt/emanetci && ./scripts/update.sh` (GHCR'dan
`latest` çeker, imaj derlemez).

## Üretim sırları

`docker-compose.env` elle düzenlenmez — tek doğruluk kaynağı SSM Parameter Store
(`/bagajpark/env/app/*`), dosya her deploy'da oradan üretilir. Akış: [`ops/SECRETS.md`](SECRETS.md).
Sunucuda sır dosyasının adı `docker-compose.env`; `/opt/emanetci/.env` yoktur (2026-10-25
yeniden kurulumundan beri). Sunucuda çalışan betikler önce `docker-compose.env`'i okumalı.

## SSH ile bağlantı

```bash
cp ops/server.env.example ops/server.env   # SSH_HOST / SSH_PORT / SSH_USER / SSH_KEY_PATH / APP_DIR
source ops/server.env
ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST"
```

Origin IP bilerek repoya yazılmaz (Cloudflare yalnızca kendi aralıklarından 80/443'e izin
veriyor); güncel değer `infra/aws/README.md`'deki `describe-addresses` komutuyla okunur.
SSH, güvenlik grubunda yalnızca `allowed_ssh_cidr`'a açıktır.

## Yedek ve geri yükleme (Postgres)

Veri `postgres_data` volume'ünde. Yedek `pg_dump -Fc` ile alınır (`scripts/backup.sh`).

**Otomatik:** `ops/crontab.prod` → 6 saatte bir `scripts/backup-s3.sh --bucket <yedek-bucket>`:
`backup.sh` ile dump alır, `s3://<yedek-bucket>/backups/`'a kopyalar, yerelde 14 günden
eski dump'ları siler. Yetki EC2 rolünden gelir (statik anahtar yok). Güncel bucket adı
`infra/aws/stack/variables.tf` → `deploy_config_bucket` (Terraform çıktısı
`backup_bucket_name`). Log: `/opt/emanetci/logs/backup.log`.

**Şifreleme (age), fail-closed:** `backup-s3.sh` dump'ı yalnız şu iki durumda S3'e yükler:
SSM'de `BACKUP_AGE_RECIPIENT` (age genel anahtarı, `age1...`) varsa `age -r` ile şifreleyip
`backups/<dosya>.dump.age` olarak; yoksa yalnız `BACKUP_ALLOW_PLAINTEXT=1` bilinçli olarak
tanımlıysa düz. İkisi de yoksa, `age` kurulu değilse ya da şifreleme düşerse **yüklemez** ve
`ERROR` ile çıkar. Değerler ortamdan, yoksa `docker-compose.env`'den (SSM'den üretilir) okunur.

Sahibin adımları (sırayla; bu sürüm deploy edildiği an ikisi de yoksa yedek durur):

1. Sunucu DIŞINDA anahtar üret: `age-keygen -o bagajpark-backup.key`. Özel anahtar parola
   yöneticisinde/çevrimdışı kalır, sunucuya hiç gitmez.
2. Çıktıdaki `age1...` genel anahtarı SSM'e `BACKUP_AGE_RECIPIENT` olarak yaz.
3. Sunucuya `age` kur ve `command -v age` ile doğrula.
4. Env dosyasını yeniden üret (`scripts/secrets-render.sh`) ya da bir sonraki deploy'u bekle.
5. O zamana kadar yedek sürsün istiyorsan SSM'e bilinçli olarak `BACKUP_ALLOW_PLAINTEXT=1`
   yaz; 3. adımdan sonra sil.

**İzleme:** başarılı her yüklemeden sonra betik `/api/internal/backup-heartbeat`'i çağırır
(`call-internal-job.sh`, `CRON_SECRET`). `src/lib/jobs/registry.ts` içindeki `backup-heartbeat`
işi `maxStaleHours: 13`; 13 saattir başarı yoksa `GET /api/health/jobs` onu `stale` gösterir
ve 503 döner. Yani şifreleme ayarı eksik, `age` yok ya da S3 hatası, en geç iki kaçırılmış
koşuda görünür olur. Bu iş `hostTriggered`: `emit-crontab.sh` onun için satır üretmez, cron
satırı `ops/crontab.prod`'un sunucuya özgü bölümünde.

**Saklama:** `infra/aws/bootstrap` yaşam döngüsü kuralı `backups/` önekindeki dump'ların
güncel sürümünü 35 günde sona erdirir, noncurrent sürümleri 7 gün sonra siler, artakalan silme
işaretlerini temizler. **İlk apply'dan ÖNCE:** kural 35 günden eski BÜTÜN dump'ları siler.
Önce en eskileri listele ve saklanacakları başka bir öneke kopyala:

```bash
aws s3api list-objects-v2 --bucket <yedek-bucket> --prefix backups/ \
  --query 'sort_by(Contents,&LastModified)[:20].[Key,LastModified,Size]' --output table
aws s3 cp s3://<yedek-bucket>/backups/<dosya> s3://<yedek-bucket>/archive/<dosya>
```

`archive/` öneki kuralın kapsamı dışında; instance rolü oraya yazamaz, kopyayı yetkili
profille sen yaparsın.

**Elle yedek** (sunucuda, onarım betiklerinden önce zorunlu):

```bash
cd /opt/emanetci && ./scripts/backup.sh
# çıktı: backups/emanetci_YYYYMMDD_HHMMSS.dump
# INCLUDE_PUBLIC=1  public/ klasörünü de tar.gz olarak ekler
# BACKUP_DIR=...    yedek dizini (varsayılan <kök>/backups)
```

**Geri yükleme** — yıkıcıdır: `pg_restore --clean --if-exists` mevcut nesneleri silip
yedeği yükler, `web` kısa süre durur:

```bash
cd /opt/emanetci && ./scripts/restore.sh backups/emanetci_<tarih>.dump
FORCE=1 ROOT=/opt/emanetci ./scripts/restore.sh backups/emanetci_<tarih>.dump   # onay sormaz
curl -s http://127.0.0.1/api/health/live   # sonra
```

S3'teki bir yedeği geri yüklemek için önce `aws s3 cp s3://<yedek-bucket>/backups/<dosya> backups/`.
Dosya `.dump.age` ise özel anahtarın bulunduğu makinede çözülür, sunucuya yalnız çözülmüş
dump gider (anahtar sunucuya kopyalanmaz):

```bash
age -d -i bagajpark-backup.key -o emanetci_<tarih>.dump emanetci_<tarih>.dump.age
scp emanetci_<tarih>.dump <sunucu>:/opt/emanetci/backups/
```

Tam dump şemayı da taşıdığı için ayrıca `prisma migrate deploy` gerekmez; `web` başlarken
zaten koşar. `pg_restore`'un `EXTENSION`/sahip uyarıları kritik hata değildir. Hesap
taşımalarında aynı iki betik kullanıldı (`infra/aws/README.md`).

## Kurallar

- **Salt-okunur önce.** Sunucuda önce `docker compose ps`, `docker compose logs`,
  `df -h`, `docker compose exec -T nginx nginx -t` gibi komutlar; değişiklik yapan hiçbir
  komut onaysız çalıştırılmaz.
- **Sır değerleri asla ekrana yazdırılmaz.** `docker-compose.env` içindeki anahtarlar için
  yalnızca *var mı / boş mu* kontrol edilir (`grep -c`, uzunluk); değer `cat`/`echo` edilmez.
- `ops/server.env` bu makineden çıkmaz; başka makinede yeniden doldurulur.
