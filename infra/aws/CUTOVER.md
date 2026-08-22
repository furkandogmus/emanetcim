# Hetzner → AWS kesim (cutover) runbook'u

## Son durum — 2026-08-22

| Adım | Durum |
|---|---|
| AWS instance `i-015afc0ebcbb989d5` (`c7i-flex.large`, eu-central-1, EIP `<ORIGIN_IP>`) | ✅ çalışıyor, `aws-test.bagajpark.com` üzerinde aynı stack |
| Prod `.env` → AWS `/opt/emanetci/docker-compose.env.prod` | ✅ staged (aktif değil) |
| Cloudflare origin sertifikası `bagajpark.{crt,key}` → `/etc/ssl/cloudflare/` | ✅ |
| Prod nginx conf (`bagajpark.com` + `aws-test` blokları) → `default.conf.prod` | ✅ `nginx -t` geçti |
| `public/` (11 dosya), `scripts/`, `crontab.prod` | ✅ staged |
| `cronie` (AL2023'te yoktu) | ✅ kuruldu, `crond` aktif |
| S3 yedek izni (`app_backup_write`) | ⏳ **terraform apply bekliyor** (aşağıda) |
| Veri taşıma, env/nginx swap, DNS | ⏳ **kesim penceresi** (aşağıda) |

Prod DB: 21 MB, 19 rezervasyon, 39 kullanıcı, 3 dükkan (2026-08-22 20:37 UTC+3).

## ⚠️ Önce bilinmesi gereken

- AWS hesabı **Free Plan + ~$47 kredi**. `c7i-flex.large` 7/24 ≈ $35-45/ay. Kredi bitince
  hesap **kapanır**. Kesimden önce veya hemen sonra hesabı Paid plana yükseltin (Billing →
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
# Beklenen: "Plan: 1 to add, 1 to change, 0 to destroy." — add: app_backup_write,
# change: security group SSH CIDR (kendi IP'niz önceki apply'dan farklıysa; beklenen)
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

- 1 hafta sorunsuz geçince Hetzner sunucusunu kapat/iptal et; `ops/README.md` ve
  `infra/aws/README.md`'deki "AWS = doğrulama kapısı, Hetzner = canlı" politikasını güncelle.
- `.github/workflows/deploy.yml` zaten AWS'e gidiyor; `main` push = canlı deploy olur.
  Küçük değişiklikler için `develop` → PR → `main` disiplini şart.
- AWS hesabını Paid plana yükselt; Cost Explorer'ı 1 hafta sonra kontrol et.
