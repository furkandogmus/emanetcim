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

## Kapasite ve performans izleme

2026-11-28'den beri bellek sınırları ve izleme ayarları `docker-compose.yml`'de açıklamalı
olarak duruyor. Sunucuya **salt okunur** bakmak için aşağıdaki komutlar yeter; hepsi
`/opt/emanetci` içinde, `docker compose --env-file docker-compose.env` ile çalışır
(aşağıda `dc` diye kısaltıldı).

**Bu ayarlar ilk kez deploy edilmeden önce** (`main`'e merge = deploy), sunucuda bir kez:

```bash
dc exec -T postgres sh -c 'ls "$(pg_config --pkglibdir)/pg_stat_statements.so"'   # dosya yoksa MERGE ETME
free -m                                                                         # "available" >= 3000 olmalı
```

`pg_stat_statements.so` yoksa Postgres yeni ayarla açılmaz ve site düşer. Merge'ün kendisi
`postgres` ve `redis` konteynerlerini yeniden oluşturur: Postgres birkaç saniye kapanır
(veri birimde kalır), Redis boş başlar. Redis boşalınca hız sınırı sayaçları ve mobil oturum
yenileme kayıtları sıfırlanır; bu bugün her Redis yeniden başlatmasında da oluyor. Trafiğin
az olduğu saatte merge edin.

### Yavaş sorgular

500 ms'yi aşan her sorgu Postgres loguna düşer; bağlı parametreler (e-posta, telefon)
**yazılmaz** (`log_parameter_max_length=0`).

```bash
dc logs --since 24h postgres | grep 'duration:' | sort -t: -k5 -rn | head -20
```

Sorgu başına toplam süre için `pg_stat_statements` uzantısı bir kez oluşturulur
(`shared_preload_libraries` zaten yüklüyor; migrasyona konmadı çünkü CI'daki Postgres
servisinde ön yükleme yok):

```bash
dc exec -T postgres psql -U bagajpark -d bagajpark -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'
dc exec -T postgres psql -U bagajpark -d bagajpark -c "
  SELECT calls, round(total_exec_time) AS toplam_ms, round(mean_exec_time) AS ort_ms, left(query, 120) AS sorgu
  FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 15;"
```

İlk sıradaki birkaç sorgu genelde toplam sürenin çoğunu taşır; indeks ya da `select`
daraltma oradan başlar. Sayaçları sıfırlamak: `SELECT pg_stat_statements_reset();`.

### Redis belleği

`/api/health/jobs` → `checks.redisMemory`. Anahtar boşaltıldıysa ya da bellek %90'ı geçtiyse
`broken` olur ve uç `503` döner; %75'te `warning` (loga `health_jobs_redis_memory`).

```bash
curl -s -H "X-Cron-Secret: $CRON_SECRET" https://bagajpark.com/api/health/jobs | jq .checks.redisMemory
dc exec -T redis redis-cli INFO memory | grep -E 'used_memory_human|maxmemory_human|maxmemory_policy'
dc exec -T redis redis-cli --scan --pattern 'rtjti:v1:*' | wc -l    # mobil oturum yenileme kaydı sayısı
```

Yenileme kaydı ~165 bayt ve 30 güne kadar yaşar; 192 MB yaklaşık 1,1 milyon kayıt eder. Son
sayıyı aylık aktif mobil kullanıcıya bölmek kullanıcı başına kayıt sayısını, yani bu sınırın
kaç kullanıcıya yettiğini verir.

### Yavaş zamanlanmış işler

`call-internal-job.sh` her işi 120 sn'de keser. Son çalışması 60 sn'yi geçen iş
`checks.scheduledJobs.slowJobs`'ta görünür (loga `job_health_slow`); sağlığı bozmaz. Bir iş
oraya düştüyse kesilmeden önce bölünmeli ya da süresi `ops/crontab.prod`'da artırılmalı.

## Cloudflare önbelleği (oturumsuz sayfalar)

Bugün HTML hiç önbelleklenmiyor (`cf-cache-status: DYNAMIC`); oysa ana sayfa, şehir, blog ve
SSS sayfaları zaten `Cache-Control: s-maxage=…` gönderiyor. Bu sayfaları Cloudflare'de
tutmak, oturumsuz trafiğin çoğunu sunucuya hiç ulaştırmaz. **En büyük kapasite kazancı ve en
riskli değişiklik budur**; aşağıdaki doğrulamalar geçmeden açık bırakılmaz.

**Risk:** Next.js aynı adrese iki farklı gövde döndürür: tarayıcıya HTML, istemci içi geçişte
`RSC: 1` başlığıyla RSC verisi. Fark `Vary` başlığında yazılı ama Cloudflare `Vary`'i
(Accept-Encoding dışında) kullanmaz. Kural `RSC` başlıklı istekleri dışlamazsa, tek bir
`curl -H 'RSC: 1'` isteği sayfanın RSC verisini önbelleğe koyar ve sonraki herkes HTML yerine
onu görür (önbellek zehirlenmesi).

**Kural** (Caching → Cache Rules, tek kural):

- Eşleşme: host `bagajpark.com`, yöntem `GET`, yol `/api/`, `/_next/` ile başlamıyor;
  istekte `rsc`, `next-router-state-tree`, `next-router-prefetch`, `next-action` başlıkları
  yok; `Cookie` başlığı `authjs.session-token` **içermiyor** (bu alt dize `__Secure-` önekli
  ve parçalı `.0`/`.1` oturum çerezlerini de yakalar).
- Eylem: önbelleğe uygun; kenar TTL'i "kaynağın Cache-Control'üne uy". Kaynak dinamik
  sayfalarda zaten `private, no-store` gönderiyor, onlar önbelleğe girmez.

Ücretsiz planda Cache Rules'un HTML'i önbelleğe almadığı raporları var; öyleyse aynı
koşullarla "Cache Everything" Page Rule gerekir. Hangisinin çalıştığını aşağıdaki ilk adım
söyler.

**Doğrulama** (kural açıldıktan hemen sonra, sırayla):

```bash
U=https://bagajpark.com/tr
curl -sI $U | grep -iE 'cf-cache-status|cache-control'                     # 2. istekte HIT
curl -sI -H 'RSC: 1' $U | grep -iE 'cf-cache-status|content-type'          # BYPASS/DYNAMIC olmalı
curl -s $U | head -c 200                                                    # <!DOCTYPE html> olmalı
curl -sI -H 'Cookie: __Secure-authjs.session-token=x' $U | grep -i cf-cache-status   # HIT olmamalı
curl -sI https://bagajpark.com/tr/bookings | grep -iE 'cf-cache-status|cache-control' # private, HIT değil
```

Herhangi biri beklenenden farklıysa kural kapatılır ve **Caching → Configuration → Purge
Everything** yapılır. Sayfa içeriği değiştiğinde (yeni dükkan, blog yazısı) Cloudflare'deki
kopya `s-maxage` kadar (120–300 sn) eski kalabilir.

## Kurallar

- **Salt-okunur önce.** Sunucuda önce `docker compose ps`, `docker compose logs`,
  `df -h`, `docker compose exec -T nginx nginx -t` gibi komutlar; değişiklik yapan hiçbir
  komut onaysız çalıştırılmaz.
- **Sır değerleri asla ekrana yazdırılmaz.** `docker-compose.env` içindeki anahtarlar için
  yalnızca *var mı / boş mu* kontrol edilir (`grep -c`, uzunluk); değer `cat`/`echo` edilmez.
- `ops/server.env` bu makineden çıkmaz; başka makinede yeniden doldurulur.
