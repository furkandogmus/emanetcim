# AWS paralel ortamı — Terraform

Bağlı olduğu değişiklik önerisi: `openspec/changes/aws-paralel-ortam/` (Latest state +
History orada — `tasks.md` gerçekte ne yapıldığının, hangi sırayla ve hangi hatalarla
karşılaşıldığının kaydı). Bu dizin, Hetzner'de çalışan prod sunucuyu **etkilemeyen**,
tamamen ayrı ve deneysel bir AWS ortamıdır: `https://aws-test.bagajpark.com`.

## Neden iki kök var

| Kök | İçerik | Ne sıklıkla değişir |
|-----|--------|----------------------|
| `bootstrap/` | S3 backup bucket'ı, TLS materyali (SSM SecureString) | Neredeyse hiç. `stack/` `destroy` edilse bile bu **sağ kalır** — canlıda doğrulandı (2026-08-21). |
| `stack/` | VPC, EC2, security group, IAM role, Elastic IP | Sık — test için aç, iş bitince sök/durdur. |

Bu ayrım kasıtlı: `stack/`'i `terraform destroy` ederken backup bucket'ının veya TLS
sertifikasının yanlışlıkla silinmesini engeller.

## Ön koşullar

- `terraform >= 1.9`
- `aws` CLI, `bagajpark` profili yapılandırılmış (`aws sts get-caller-identity --profile
  bagajpark` çalışmalı — secret hiçbir zaman bu profile dışında bir yere yazılmaz)
- `~/.ssh/aws-bagajpark` / `.pub` keypair'i (üretildi, tekrar gerekmez):
  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/aws-bagajpark -N "" -C "aws-bagajpark-test"
  ```
- Kendi public IP'ni öğren (SSH'ı sadece kendine açmak için): `curl -s https://ifconfig.me`
- Cloudflare Origin Certificate (`aws-test.bagajpark.com` için, dashboard → SSL/TLS →
  Origin Server → Create Certificate) — `.crt`/`.key` dosyaları yerelde bir yerde dursun
  (varsayılan yol `~/Documents/personal/tls/aws-test.{crt,key}`, `bootstrap/variables.tf`
  → `tls_cert_path`/`tls_key_path` ile değiştirilebilir)
- **`terraform-bagajpark` IAM kullanıcısının yetkileri EC2/VPC/S3 FullAccess'in ÜZERİNDE**
  — SSM+KMS+scoped-IAM-role izinleri de gerekiyor (aşağıya bak, "IAM kullanıcı yetkileri").

## IAM kullanıcı yetkileri (root ile, bir kere)

`terraform-bagajpark`'a `AmazonEC2FullAccess` + `AmazonVPCFullAccess` + `AmazonS3FullAccess`
managed policy'lerinin YETMEDİĞİ ortaya çıktı (TLS-via-SSM otomasyonu eklenince). Ek olarak
şu inline policy gerekli — root ile (`aws iam put-user-policy --user-name
terraform-bagajpark ...`), `terraform-bagajpark`'ın kendisi bunu kendine veremez
(iam:PutUserPolicy yetkisi yok, kasıtlı):

- `ssm:PutParameter/GetParameter/GetParameters/DeleteParameter/AddTagsToResource/ListTagsForResource`
  → sadece `arn:aws:ssm:*:<account>:parameter/bagajpark/*`
- `ssm:DescribeParameters` → `Resource:"*"` (AWS kısıtı — bu action resource-level ARN
  desteklemiyor, provider her `aws_ssm_parameter` için bunu da çağırıyor)
- `kms:Encrypt/Decrypt/GenerateDataKey` → `Resource:"*"`, `Condition:
  kms:ViaService=ssm.*.amazonaws.com` (SecureString'in varsayılan AWS-managed anahtarı için)
- `iam:CreateRole/DeleteRole/GetRole/PutRolePolicy/DeleteRolePolicy/GetRolePolicy/
  ListRolePolicies/ListAttachedRolePolicies/CreateInstanceProfile/DeleteInstanceProfile/
  GetInstanceProfile/AddRoleToInstanceProfile/RemoveRoleFromInstanceProfile/PassRole/
  TagRole/UntagRole/TagInstanceProfile/UntagInstanceProfile/ListInstanceProfilesForRole/
  ListInstanceProfiles` → sadece `arn:aws:iam::<account>:role/bagajpark-aws-test-*` ve
  `.../instance-profile/bagajpark-aws-test-*`

Tam policy JSON'u repoda değil — root'un elle çalıştırdığı tek seferlik bir komuttu, ihtiyaç
olursa bu listeden yeniden üretilebilir.

## Kurulum — sıra önemli

### 1. `bootstrap/` (bir kere, kalıcı)

```bash
cd infra/aws/bootstrap
terraform init
terraform plan   # cert/key değerleri (sensitive) plan çıktısında GÖRÜNMEZ
terraform apply
terraform output backup_bucket_name
terraform output tls_cert_parameter_name
```

### 2. `stack/` (test için aç)

```bash
cd infra/aws/stack
terraform init
terraform plan -var="allowed_ssh_cidr=<senin-ip>/32"
terraform apply -var="allowed_ssh_cidr=<senin-ip>/32"
terraform output ssh_command
terraform output public_ip
```

Beklenen: `apply` ~1-2 dakika sürer (EC2 boot + cloud-init). cloud-init şunları OTOMATİK
yapar — manuel adım yok:
- Docker + Compose plugin kurulumu
- SSH portunu değiştirme (SELinux label + fail2ban, doğru portu izleyecek şekilde)
- **TLS sertifikasını SSM'den kendi IAM rolüyle çekme** (`/etc/ssl/cloudflare/aws-test.{crt,key}`)
  — statik AWS key instance'a hiç konmaz

**Doğrulama:**
```bash
$(terraform output -raw ssh_command)
# bağlandıktan sonra:
cat /var/log/bagajpark-cloud-init-done   # "cloud-init tamam: ..." görmelisin
docker compose version
sudo fail2ban-client status sshd
ls -la /etc/ssl/cloudflare/   # aws-test.crt (644) + aws-test.key (600) OTOMATİK burada olmalı
```

### 3. DNS'i güncelle (EIP her `apply`'da DEĞİŞİR)

**Bilinen sınırlama**: `stack` her `destroy`+`apply` edildiğinde yeni bir Elastic IP
allocation'ı oluşur — eski IP kaybolur. Cloudflare'de `aws-test.bagajpark.com` A kaydını
yeni `terraform output public_ip` değerine **elle** güncellemen gerekiyor (Proxied/turuncu
bulut açık kalsın). Otomatik değil — Route53 ya da Cloudflare API entegrasyonu ile
otomatikleştirilebilir, şimdilik kapsam dışı.

### 4. Uygulamayı taşı (henüz elle — otomatik değil)

```bash
scp -i ~/.ssh/aws-bagajpark -P $(terraform output -raw ssh_port) \
  ../../../docker-compose.yml \
  ec2-user@$(terraform output -raw public_ip):/opt/emanetci/docker-compose.yml

# .env: yeni AUTH_SECRET üret, domain'i aws-test.bagajpark.com yap
AUTH_SECRET=$(openssl rand -base64 32)
cat > /tmp/docker-compose.env <<EOF
AUTH_SECRET=${AUTH_SECRET}
AUTH_PUBLIC_HOST=aws-test.bagajpark.com
NEXT_PUBLIC_APP_URL=https://aws-test.bagajpark.com
AUTH_TRUST_HOST=true
EOF
scp -i ~/.ssh/aws-bagajpark -P $(terraform output -raw ssh_port) \
  /tmp/docker-compose.env ec2-user@$(terraform output -raw public_ip):/opt/emanetci/docker-compose.env
rm /tmp/docker-compose.env

# nginx config (00-map.conf, 01-hardening.conf repodan aynen; default.conf'un
# aws-test sürümü — server_name + cert yolu aws-test'e göre)
ssh ... "mkdir -p /opt/emanetci/nginx/conf.d /opt/emanetci/public"
scp ... nginx/conf.d/00-map.conf nginx/conf.d/01-hardening.conf ec2-user@...:/opt/emanetci/nginx/conf.d/
# default.conf: repodaki bagajpark.com sürümü DEĞİL — server_name=aws-test.bagajpark.com,
# ssl_certificate(_key)=/etc/ssl/cloudflare/aws-test.{crt,key} olacak şekilde uyarlanmış
# bir kopya kullan (Cloudflare real-ip restore bloğu bu grey-cloud-olmayan senaryoda
# gerekmiyor ama zararsız, isterse eklenebilir)

ssh ... "cd /opt/emanetci && docker compose --env-file docker-compose.env up -d"
curl https://aws-test.bagajpark.com/api/health/live
```

## Maliyet — $47.53 kredi, $40 alarm eşiği

- **Free Plan hesap kısıtı**: EC2 API sadece `free-tier-eligible=true` instance tiplerini
  kabul ediyor (`aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true`).
  `t3.medium` reddedildi; `instance_type` varsayılanı `c7i-flex.large` (4GB, x86_64, izinli).
- `c7i-flex.large` on-demand ≈ $0.04-0.06/saat (bölgeye göre) → **7/24 açık bırakma**,
  birkaç haftada krediyi tüketir.
- Disiplin: test bitince
  ```bash
  aws ec2 stop-instances --profile bagajpark --instance-ids $(terraform output -raw instance_id)
  ```
  (durdurulmuş instance'ın compute ücreti kesilmez, sadece EBS depolama — aylık centler)
- Bütçe alarmı zaten kurulu: `bagajpark-aws-test-guardrail`, $40/ay, %25/50/80/100'de
  `furkandogmus9183@gmail.com`'a email.
- Bir hafta sonra: Billing → Cost Explorer'dan gerçek harcamayı tahminle karşılaştır.

## Söküm

```bash
cd infra/aws/stack
terraform destroy -var="allowed_ssh_cidr=<senin-ip>/32"
# bootstrap/ dokunulmaz — S3 backup bucket ve SSM'deki TLS materyali sağ kalır
# (2026-08-21'de fiilen doğrulandı: destroy sonrası terraform state list boş,
# ama bootstrap'taki S3/SSM kaynakları head-bucket/describe-parameters ile sağlam çıktı)
```

## Taşınabilirlik (hesap/kredi değişirse)

Hiçbir dosyada hesap ID'si, sabit bucket adı veya bölgeye özel bir kaynak ID'si hardcode
edilmemiştir. Yeni bir free-tier hesaba geçişte:

1. Yeni hesapta `aws configure --profile <yeni-profil>` yap, "IAM kullanıcı yetkileri"
   bölümündeki policy'leri yeni kullanıcıya da ekle
2. `bootstrap/` içinde `-var="aws_profile=<yeni-profil>"` ile tekrar `apply` (yeni, farklı
   isimli bir S3 bucket oluşur — `random_id` sayesinde çakışma olmaz; TLS cert/key yerel
   dosyadan tekrar okunup yeni hesabın SSM'ine yazılır)
3. Eski bucket'tan yeniye veri taşımak istersen: `aws s3 sync s3://eski-bucket
   s3://yeni-bucket --profile eski-profil` (iki profilin de aynı anda yapılandırılmış
   olması gerekir)
4. `stack/` içinde aynı şekilde `-var="aws_profile=<yeni-profil>"` ile `apply`

## Bilinen sınırlamalar

- **State local'de tutulur** (S3 backend yok) — sadece bu makineden `apply`/`destroy`
  edilebilir. Tek geliştirici için kabul edilebilir; ekip büyürse S3+DynamoDB backend'e
  geçilmeli.
- **Elastic IP her `stack` yeniden kurulduğunda değişir** — DNS güncellemesi elle (yukarıya
  bak). Otomatikleştirilmedi.
- **Uygulama taşıma (docker-compose.yml/.env/nginx) henüz otomatik değil** — her
  `stack` yeniden kurulduğunda elle `scp` gerekiyor. TLS materyali gibi SSM'e taşınabilir
  ama bu iterasyonun kapsamı dışında tutuldu.
- `docker-compose.env` ve gerçek `.env` dosyaları Terraform'a hiç girmez — bilinçli olarak
  elle yapılıyor, sır repo/state'e girmesin diye.
