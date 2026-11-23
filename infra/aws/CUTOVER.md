# Sunucu ve hesap taşımaları — kayıt ve kontrol listesi

> **`<ORIGIN_IP>` nedir:** origin sunucunun public IP'si bilerek repoya yazılmıyor.
> `bagajpark.com` Cloudflare arkasında ve güvenlik grubu 80/443'ü yalnızca Cloudflare
> edge aralıklarına açıyor (`infra/aws/stack/main.tf`); origin adresini dokümana gömmek o
> korumanın etrafından dolaşmayı kolaylaştırır. Güncel değeri AWS'ten okuyun:
>
> ```bash
> aws ec2 describe-addresses --profile personal-prod --region eu-central-1 \
>   --query 'Addresses[].PublicIp' --output text
> ```

## Son durum — 2026-10-25 (doğrulama 2026-11-23)

`bagajpark.com` hesap **710882445040**'ta: profil `personal-prod`, Terraform workspace
`hesap3` (iki kökte de). Önceki iki hesap (269174115166, 772853132412) boşaltıldı; hesapları
kapatmak root ile konsoldan yapılır.

| | |
|---|---|
| Sunucu | `c7i-flex.large`, eu-central-1. EIP eski hesaptan **Elastic IP transferi** ile taşındı; Cloudflare'de DNS değişmedi |
| Kesinti | 2026-10-25 11:28:20 → 11:30:12 UTC (~2 dk): eski `web` durdu → son dump → yeni sunucuda `restore.sh` → EIP transferi |
| Veri | 42 tablo / 61.277 satır; iki tarafta tablo başı sayım md5'i aynı (prova + son dump) |
| Bucket'lar | yedek + deploy config `bagajpark-backups-7bec61c6`, medya `bagajpark-media-7bec61c6` (`stack/variables.tf` varsayılanları) |
| SSM | `/bagajpark/env/app/*` (42) ve canlı TLS sertifikası eski hesaptan kopyalandı |
| Cron | `ec2-user` crontab'ı yeni sunucuda kuruldu; yedek yeni bucket'a |
| GitHub vars | `AWS_DEPLOY_ROLE_ARN`, `AWS_DEPLOY_BUCKET`, `S3_PUBLIC_BASE_URL` yeni hesaba çevrildi |

**Taşımadan sonra ortaya çıkan:** sunucu yeniden kurulunca sır dosyası yalnızca
`docker-compose.env` olarak üretildi, `scripts/call-internal-job.sh` ise `.env` arıyordu.
Bu betiği kullanan bütün cron işleri 2026-10-25 → 2026-11-23 arasında hiç istek atmadı;
betik artık önce `docker-compose.env`'i okur (`47dbe18f`). Taşıma sonrası kontrol listesine
"her cron işinin `/api/health/jobs`'ta taze `lastSuccessAt`'i var mı" maddesi bu yüzden girdi.

## Geçmiş

| Tarih | Ne |
|---|---|
| 2026-08-23 | Hetzner → AWS (hesap 269174115166 → aynı gün 772853132412). Kesim ~7 dk; son dump 19 rezervasyon / 39 kullanıcı / 3 dükkan. Hetzner trafiksiz bırakıldı; aboneliğin iptali sahibine bırakıldı |
| 2026-08-29 | Kesim sonrası sapmalar kapandı: betiklerin varsayılan dizini `/root/emanetci` → `/opt/emanetci`, Terraform profil/workspace varsayılanları, TLS dosya adı (`aws-test.*` → `bagajpark.*`), sırlar SSM'e (`ops/SECRETS.md`), crontab repoya (`ops/crontab.prod`) |
| 2026-10-25 | 772853132412 → 710882445040 (yukarıda). Sebep: eski hesabın Free plan kredisi bitmek üzereydi; kredi bitince hesap kapanır |

## Bir sonraki taşıma için kontrol listesi

İki taşımada da işe yarayan sıra. Komutlar `ops/README.md` (yedek/geri yükleme) ve
`infra/aws/README.md` (Terraform) içinde.

1. **Yeni hesapta altyapı:** `bootstrap/` ve `stack/` yeni profil + yeni workspace ile
   `apply`. `stack/variables.tf` → `deploy_config_bucket` ve `media_bucket_name` varsayılanlarını
   yeni bucket adlarıyla güncelle (random_id içerdikleri için sözleşmeyle bağlanmıyorlar).
2. **SSM:** `/bagajpark/env/app/*` ve canlı TLS parametresini kopyala. `bootstrap` yerel
   sertifika dosyasından yazıyorsa dosyanın **canlı** alan adına ait olduğunu doğrula
   (2026-10-25'te `aws-test` sertifikası yazılmıştı).
3. **Instance doğrulaması:** `amazon-ssm-agent` ve `crond` çalışıyor mu
   (`systemctl is-active amazon-ssm-agent crond`). AL2023 ikisini kurulu getirmiyor;
   cloud-init artık kuruyor.
4. **Prova:** yeni sunucuda prod konfigle `up -d`, son bir dump'ı geri yükle, tablo başı
   sayımları karşılaştır, `curl -sk --resolve bagajpark.com:443:<ORIGIN_IP> https://bagajpark.com/api/health`.
5. **Kesim:** eski `web`'i durdur (yazma durur) → son dump → yeni sunucuda
   `FORCE=1 ROOT=/opt/emanetci ./scripts/restore.sh` → sayımları karşılaştır → EIP
   transferi ya da Cloudflare A kaydı (Proxied açık).
6. **Cron:** `ops/crontab.prod` başındaki KURULUM adımları; yedek satırındaki bucket adını
   yeni hesabınkiyle değiştir.
7. **GitHub vars:** `AWS_DEPLOY_ROLE_ARN`, `AWS_DEPLOY_BUCKET`, `S3_PUBLIC_BASE_URL`.
   `S3_PUBLIC_BASE_URL` imaja gömülür; DB'deki eski medya adreslerini de çevir.
8. **Ertesi gün:** `curl -s https://bagajpark.com/api/health/jobs | jq '.checks.scheduledJobs'`
   — her `enforced` işin taze `lastSuccessAt`'i olmalı; yedek S3'e düşmüş olmalı.
9. Eski hesabı boşalt: workspace `destroy` (EIP önce state'ten çıkarılır), bucket'ları
   arşivle ve sil, SSM parametrelerini sil.
