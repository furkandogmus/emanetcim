# Hetzner → AWS kesim (cutover) runbook'u

> **`<ORIGIN_IP>` nedir:** origin sunucunun public IP'si bilerek repoya yazılmıyor.
> `bagajpark.com` Cloudflare arkasında ve güvenlik grubu 80/443'ü yalnızca
> Cloudflare edge aralıklarına açıyor (`infra/aws/stack/main.tf`); origin adresini
> dokümana gömmek o korumanın etrafından dolaşmayı kolaylaştırır. Güncel değeri
> her zaman AWS'ten okuyun:
>
> ```bash
> aws ec2 describe-addresses --profile personal-prod --region eu-central-1 \
>   --query 'Addresses[].PublicIp' --output text
> ```

## Son durum — 2026-10-25 11:30 UTC

**İKİNCİ HESAP TAŞIMA TAMAMLANDI. `bagajpark.com` artık hesap 710882445040'ta**
(profil `personal-prod`, terraform workspace `hesap3`, iki kökte de). Eski hesap
772853132412 yerindeburger ile ortaktı ve Free plan kredisi bitmek üzereydi.

| | |
|---|---|
| Sunucu | `i-025a7f973c0210468` (c7i-flex.large). EIP aynı: eski hesaptan **Elastic IP transferi** ile taşındı, Cloudflare'de DNS değişmedi |
| Kesinti | 11:28:20 → 11:30:12 UTC (~2 dk): eski `web` durdu → son dump → yeni sunucuda `restore.sh` → EIP transferi |
| Veri | 42 tablo / 61.277 satır, iki tarafta tablo başı sayım md5'i aynı (prova + son dump) |
| Bucket'lar | yedek + deploy config `bagajpark-backups-7bec61c6`, medya `bagajpark-media-7bec61c6`. Eski yedek geçmişi kopyalandı |
| SSM | `/bagajpark/env/app/*` (42) ve canlı TLS sertifikası eski hesaptan kopyalandı; `S3_BUCKET` yeni medya bucket'ı |
| Cron | `ec2-user` crontab'ı yeni sunucuda (12 iş), yedek yeni bucket'a; eski sunucunun crontab'ı kaldırıldı (`/opt/emanetci/crontab.pre-move.txt`) |
| GitHub vars | `AWS_DEPLOY_ROLE_ARN`, `AWS_DEPLOY_BUCKET`, `S3_PUBLIC_BASE_URL` yeni hesaba çevrildi |

**Açık işler**

- `next/image` izinli alan adı build anında `S3_PUBLIC_BASE_URL`'den üretiliyor (`next.config.ts`).
  Canlı imaj hâlâ eski medya bucket'ına izin veriyor, DB'deki 3 dükkan fotoğrafı URL'si de eski
  bucket'ı gösteriyor. Bu yüzden eski medya bucket'ı **silinmedi**. `main`'e ilk merge yeni
  değişkenle imajı yeniden üretir; o deploy'dan sonra 3 URL'de
  `bagajpark-media-1d9eb152` → `bagajpark-media-7bec61c6` güncellenir, sonra eski bucket silinir.
- Eski hesapta kalanlar (1 hafta geri dönüş payı, sonra `hesap2` workspace'i ile `terraform destroy`):
  durmuş web'li instance `i-0753b8302a5f73413` (EIP'siz), bucket'lar.

**Kesimde bulunanlar**

- Yeni AL2023 AMI'sinde `amazon-ssm-agent` ve `cronie` kurulu gelmiyor; cloud-init `|| true` ile
  bunu yutuyordu, instance SSM'e bağlanmadı. Artık cloud-init ikisini kuruyor.
- `bootstrap` TLS parametresini yerel `aws-test.crt`'den yazıyor; o dosya `aws-test.bagajpark.com`
  sertifikası, canlı olan değil. cloud-init'in alan adı kontrolü burada durdu. Canlı sertifika eski
  hesabın SSM'inden kopyalandı; `bootstrap` artık değeri `ignore_changes` ile yeniden yazmıyor.
- Terraform `>= 1.9` istiyor; yereldeki varsayılan 1.5.7 (`TFENV_TERRAFORM_VERSION=1.9.8`).

## Önceki durum — 2026-08-23 15:30 (UTC+3)

**HESAP TAŞIMA TAMAMLANDI. `bagajpark.com` artık YENİ AWS hesabında (772853132412).**

| | |
|---|---|
| Sunucu | `<ORIGIN_IP>:2222` (eu-central-1, `hesap2` terraform workspace, profil `bagajpark-yeni`) |
| Veri | son dump `emanetci_20260823_122308` (19/39/3) — kesim penceresi ~7 dk |
| Yedek | `s3://bagajpark-backups-1d9eb152/backups/` (6 saatte bir cron) |
| Deploy | GitHub vars yeni hesaba çevrildi (`AWS_DEPLOY_ROLE_ARN`, `AWS_DEPLOY_BUCKET`); `main` push → yeni hesap |
| Eski AWS (269174115166) | konteynerler `down`, instance `i-015afc0ebcbb989d5` STOPPED — 1 hafta geri dönüş payı, sonra `terraform destroy` (workspace `default`) + hesap kapatma |
| Hetzner | sunucu açık ama trafiksiz; aboneliği İPTAL ET (kullanıcı) |
| Terraform | eski hesap state'i `default` workspace'te, yeni hesap `hesap2`'de |

Taşınabilirlik provası + kesimde bulunanlar: bildirilmemiş `budget_name` değişkeni;
IAM policy listesine `iam:ListOpenIDConnectProviders` ve `budgets:TagResource/UntagResource/ListTagsForResource`
eklenmesi gerekti (README güncellenmeli). Sıfır hesaptan çalışan kopyaya ~25 dk.

## ⚠️ Önce bilinmesi gereken

- AWS hesabı **Free Plan + ~$47 kredi**. `c7i-flex.large` 7/24 = **~$70.63/ay** (AWS fiyat
  listesi, eu-central-1, 2026-08-29 doğrulandı; burada önceden "$35-45/ay" yazıyordu ve
  yanlıştı). EBS + public IPv4 ile birlikte **~$77/ay**. Kredi bitince hesap **kapanır**. Kesimden önce veya hemen sonra hesabı Paid plana yükseltin (Billing →
  Account → Upgrade). Bütçe alarmı `$40/ay` kurulu.
- DNS Cloudflare'de, API token yok: A kayıtları **elle** değiştirilir.
- Kesim penceresinde site ~5 dk kapalı olur (yazma kaybı olmaması için).

## 0. Ön koşullar (bu makine)

```bash
cd <repo>
ssh hetzner 'hostname'                                                  # rocky-4gb-nbg1-2
ssh -i ~/.ssh/aws-bagajpark -p 2222 ec2-user@<ORIGIN_IP> 'hostname'  # ip-10-20-1-*
aws sts get-caller-identity --profile bagajpark --query Account --output text  # 269174115166
```

## 1. Terraform — yedek yazma izni (değişen tek kaynak: bir IAM inline policy)

```bash
cd infra/aws/stack
terraform plan  -var="allowed_ssh_cidr=$(curl -s https://ifconfig.me)/32"
# Beklenen: "Plan: 1 to add, 0 to change, 0 to destroy." (aws_iam_role_policy.app_backup_write)
# "aws_instance.app will be updated in-place" GÖRÜRSENİZ DURUN: bu instance'ı dur-kalk
# ettirir. user_data artık ignore_changes'ta; görünüyorsa main.tf'i kontrol edin.
terraform apply -var="allowed_ssh_cidr=$(curl -s https://ifconfig.me)/32"
```

Doğrulama (read-only, instance'ta):
```bash
ssh -i ~/.ssh/aws-bagajpark -p 2222 ec2-user@<ORIGIN_IP> \
  'echo test | aws s3 cp - s3://bagajpark-backups-43403243/backups/_probe.txt && echo "s3 write ok"'
```

## 2. Prova (canlıya dokunmaz) — AWS'te prod konfig ile çalıştırıp `--resolve` ile test

```bash
ssh -i ~/.ssh/aws-bagajpark -p 2222 ec2-user@<ORIGIN_IP> 'cd /opt/emanetci && \
  cp docker-compose.env docker-compose.env.awstest.bak && \
  cp nginx/conf.d/default.conf nginx/conf.d/default.conf.awstest.bak && \
  cp docker-compose.env.prod docker-compose.env && ln -sf docker-compose.env .env && \
  cp nginx/conf.d/default.conf.prod nginx/conf.d/default.conf && \
  docker compose --env-file docker-compose.env up -d --remove-orphans && \
  docker compose --env-file docker-compose.env ps'
# Beklenen: web/nginx/postgres/redis "healthy"; srh konteyneri kaldırılmış (--remove-orphans)

curl -sk --resolve bagajpark.com:443:<ORIGIN_IP> https://bagajpark.com/api/health | head -c 300
# Beklenen: {"status":"UP","checks":{"database":"ok","redis":"ok","rateLimitMode":"redis",...}}
```
Bu noktada AWS hâlâ boş/test DB ile çalışır; canlı trafik Hetzner'de.

## 3. Kesim penceresi (~5 dk kapalılık) — ilk canlıyı değiştiren adım: 3a

```bash
# 3a. Hetzner'de web'i durdur (nginx 502 döner; yazma durur)
ssh hetzner 'cd /root/emanetci && docker compose stop web'

# 3b. Son yedek + AWS'e taşı + geri yükle
ssh hetzner 'cd /root/emanetci && ./scripts/backup.sh >/dev/null && ls -t backups/*.dump | head -1'
# çıktıdaki dosya adını D'ye koy:
D=emanetci_YYYYMMDD_HHMMSS.dump
scp hetzner:/root/emanetci/backups/$D /tmp/$D
scp -i ~/.ssh/aws-bagajpark -P 2222 /tmp/$D ec2-user@<ORIGIN_IP>:/opt/emanetci/backups/$D && rm /tmp/$D
ssh -i ~/.ssh/aws-bagajpark -p 2222 ec2-user@<ORIGIN_IP> \
  "cd /opt/emanetci && FORCE=1 ROOT=/opt/emanetci ./scripts/restore.sh backups/$D && \
   docker compose --env-file docker-compose.env exec -T postgres psql -U bagajpark -d bagajpark -tAc \
   'select (select count(*) from \"Booking\"),(select count(*) from \"User\"),(select count(*) from \"Shop\")'"
# Beklenen: Hetzner'deki sayılarla birebir (ör. 19|39|3)

# 3c. Cron'u kur
# DIKKAT: crontab.prod BU REPODA YOK -- tek kopyasi sunucuda. Yani bu adim baska bir
# makinede oldugu gibi tekrarlanamaz ve sunucu giderse is listesi de gider.
# Uygulama isleri src/lib/jobs/registry.ts'ten uretilebilir (scripts/emit-crontab.sh);
# sunucuya ozgu isler (yedekleme, disk temizligi) uretilemez. Bkz. docs/DEFECT_BACKLOG.md.
ssh -i ~/.ssh/aws-bagajpark -p 2222 ec2-user@<ORIGIN_IP> \
  'crontab /opt/emanetci/crontab.prod && crontab -l | grep -c emanetci'
# Beklenen: 5

# 3d. DNS — Cloudflare dashboard: bagajpark.com ve www A kayıtlarını <ORIGIN_IP> yap (Proxied açık kalsın)

# 3e. Doğrula
curl -s https://bagajpark.com/api/health | head -c 200        # "UP"
curl -s -o /dev/null -w '%{http_code}\n' https://bagajpark.com/tr   # 200
# Tarayıcıda giriş yap, bir rezervasyon aç, esnaf panelini gör.
```

## 4. Geri alma (kesimden sonra 1 hafta boyunca mümkün)

```bash
ssh hetzner 'cd /root/emanetci && docker compose start web'
# Cloudflare A kayıtlarını 178.104.144.3'e geri al.
```
AWS'te kesim sonrası yazılan veri Hetzner'de OLMAZ — geri alma için önce AWS'ten dump alıp
Hetzner'e geri yükleyin (aynı `backup.sh`/`restore.sh`).

## 5. Kesim sonrası

- 1 hafta sorunsuz geçince Hetzner sunucusunu kapat/iptal et.
- ✅ **2026-08-29 yapıldı**: `ops/README.md` ve `infra/aws/README.md`'deki "AWS =
  doğrulama kapısı, Hetzner = canlı" politikası güncellendi. Aynı taramada bulunan ve
  düzeltilen sapmalar: script'lerin varsayılan uygulama dizini (`/root/emanetci` →
  `/opt/emanetci`), Terraform `aws_profile` varsayılanı (eski hesap → `bagajpark-yeni`,
  workspace `hesap2` ile eşleşecek şekilde) ve `deploy_config_bucket` varsayılanı (eski
  hesabın bucket'ı → `bagajpark-backups-1d9eb152`).
- `.github/workflows/ci.yml` (`deploy` job'ı) zaten AWS'e gidiyor; `main` push = canlı deploy olur.
  Küçük değişiklikler için `develop` → PR → `main` disiplini şart.
- AWS hesabını Paid plana yükselt; Cost Explorer'ı 1 hafta sonra kontrol et.
