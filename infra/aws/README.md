# AWS — canlı ortam (Terraform)

Bu dizin canlı `bagajpark.com`'u tarif eder: tek EC2 (`c7i-flex.large`, eu-central-1)
üzerinde Docker Compose. Hesap **710882445040**, profil `personal-prod`, workspace `hesap3`
(2026-10-25'ten beri). Taşıma kaydı ve bir sonraki taşımanın kontrol listesi aşağıda
§ Hesap taşımaları (eski `CUTOVER.md` 2026-11-23'te buraya katıldı). Sunucu işletimi (deploy, yedek, sırlar): [`ops/README.md`](../../ops/README.md).

Ortamın ilk kuruluş kaydı (paralel AWS ortamı, Hetzner'den kesim) `aws-paralel-ortam`
openspec önerisiydi; 2026-11-23'te silindi, git geçmişinde.

## İsimler yalan söylüyor — bilerek değiştirilmedi

Terraform kaynak adları, SSM önekleri ve bütçe adı hâlâ `aws-test` içeriyor
(`bagajpark-aws-test-*`, `/bagajpark/aws-test/tls`). Ortam test değil, canlı.
**Yine de yeniden adlandırılmadı**, çünkü:

- `.github/workflows/ci.yml` deploy job'ı hedef sunucuyu `tag:Project=bagajpark-aws-test`
  ile seçer. Ad değişirse deploy hedefi bulamaz.
- IAM rol / instance profile / EIP adları bu önekten türüyor; değiştirmek kaynakların
  yeniden yaratılması, yani **canlı kesinti** demektir.

Adı okurken "test" değil "bu projenin AWS ortamı" diye okuyun (`stack/variables.tf` →
`project_name`).

## Deploy politikası

**`main`'e merge = canlıya deploy.** Ayrı bir doğrulama ortamı yok; koruma katmanı
`main` ruleset'i (yalnızca PR, zorunlu kontroller — `docs/GELISTIRME.md`) ve
`deploy`'un doğrulama job'larına `needs` ile bağlı olmasıdır (`docs/GELISTIRME.md` § 3).

| Ne | Ne zaman | Nasıl |
|----|----------|-------|
| Canlı (`bagajpark.com`) | `main`'e her merge'de, otomatik | `.github/workflows/ci.yml` → `checks` ∥ `e2e` → `verify`, `image` paralel → `deploy` (GitHub OIDC + SSM Run Command, hedef dizin `/opt/emanetci`) |
| Elle güncelleme | CI kullanılamadığında | Sunucuda `cd /opt/emanetci && ./scripts/update.sh` |

Zamanlanmış işlerin tek doğru kaynağı `src/lib/jobs/registry.ts`, sunucudaki kopyası
`ops/crontab.prod`; gerçekte ne kurulu olduğu yalnızca sunucuda `crontab -l` ile öğrenilir
(`scripts/README.md`).

## Neden iki kök var

| Kök | İçerik | Ne sıklıkla değişir |
|-----|--------|----------------------|
| `bootstrap/` | S3 backup bucket'ı, TLS materyali (SSM SecureString) | Neredeyse hiç. `stack/` `destroy` edilse bile bu **sağ kalır** — canlıda doğrulandı (2026-08-21). |
| `stack/` | VPC, EC2, security group, IAM role, Elastic IP | Nadir. **Canlı sunucu burada** — "test bitince söküyoruz" dönemi 2026-08-23 kesimiyle bitti. |

Bu ayrım kasıtlı: `stack/`'i `terraform destroy` ederken backup bucket'ının veya TLS
sertifikasının yanlışlıkla silinmesini engeller.

## Ön koşullar

- `terraform >= 1.9`
- `aws` CLI, **`personal-prod`** profili yapılandırılmış — canlı hesap (710882445040, 2026-10-25'ten beri):
  ```bash
  aws sts get-caller-identity --profile personal-prod --query Account --output text
  # Beklenen: 710882445040
  terraform workspace show   # Beklenen: hesap3
  ```
  Profil ve workspace BİRLİKTE değişir; ayrışırsa `plan` her kaynağı "to create" gösterir
  (ayrıntı `stack/variables.tf` → `aws_profile` notu). Eski hesapların workspace'leri
  (`default`, `hesap2`) boşaltıldı.
- `~/.ssh/aws-bagajpark` / `.pub` keypair'i (üretildi, tekrar gerekmez):
  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/aws-bagajpark -N "" -C "aws-bagajpark-test"
  ```
- Kendi public IP'ni öğren (SSH'ı sadece kendine açmak için): `curl -s https://ifconfig.me`
- Cloudflare Origin Certificate: `bootstrap/` TLS parametresini yalnızca ilk oluşturmada
  yerel dosyadan yazar (`tls_cert_path`/`tls_key_path`, varsayılan `aws-test.{crt,key}`) ve
  sonra değeri `ignore_changes` ile korur. Canlı `bagajpark.com` sertifikası SSM'e
  `scripts/tls-put.sh` ile yazılır. Yerel `aws-test` dosyası canlı alan adına ait **değildir**
  (2026-10-25 taşımasında yanlışlıkla bu yazılmıştı, § Hesap taşımaları).
- **`terraform-bagajpark` IAM kullanıcısının yetkileri EC2/VPC/S3 FullAccess'in ÜZERİNDE**
  — SSM+KMS+scoped-IAM-role izinleri de gerekiyor (aşağıya bak, "IAM kullanıcı yetkileri").

## IAM kullanıcı yetkileri (root ile, bir kere)

`terraform-bagajpark`'a `AmazonEC2FullAccess` + `AmazonVPCFullAccess` + `AmazonS3FullAccess`
managed policy'lerinin YETMEDİĞİ ortaya çıktı (TLS-via-SSM otomasyonu eklenince). Ek olarak
şu inline policy gerekli — root ile (`aws iam put-user-policy --user-name
terraform-bagajpark ...`), `terraform-bagajpark`'ın kendisi bunu kendine veremez
(iam:PutUserPolicy yetkisi yok, kasıtlı):

- `ssm:PutParameter/GetParameter/GetParameters/DeleteParameter/AddTagsToResource/RemoveTagsFromResource/ListTagsForResource`
  → sadece `arn:aws:ssm:*:<account>:parameter/bagajpark/*`
- `ssm:DescribeParameters` → `Resource:"*"` (AWS kısıtı — bu action resource-level ARN
  desteklemiyor, provider her `aws_ssm_parameter` için bunu da çağırıyor)
- `kms:Encrypt/Decrypt/GenerateDataKey` → `Resource:"*"`, `Condition:
  kms:ViaService=ssm.*.amazonaws.com` (SecureString'in varsayılan AWS-managed anahtarı için)
- `iam:GetOpenIDConnectProvider/ListOpenIDConnectProviders` → `oidc-provider/*` (bootstrap'ın
  GitHub OIDC data source'u URL ile arama yapar; 2026-08-23 hesap taşımasında eksik çıktı)
- `budgets:ViewBudget/ModifyBudget/TagResource/UntagResource/ListTagsForResource` → `*`
  (bütçe alarmı; TagResource eksikliği CreateBudget'ı 400 ile düşürüyor)
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

### 2. `stack/` (canlı sunucu — dikkatli olun)

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
- `amazon-ssm-agent` ve `cronie` kurulumu (AL2023 kurulu getirmiyor)
- **TLS sertifikasını SSM'den kendi IAM rolüyle çekme** (`/etc/ssl/cloudflare/bagajpark.{crt,key}`,
  nginx'in beklediği ad) — statik AWS key instance'a hiç konmaz
- `/opt/emanetci` dizini (`ec2-user`'a ait)

**Doğrulama:**
```bash
$(terraform output -raw ssh_command)
# bağlandıktan sonra:
cat /var/log/bagajpark-cloud-init-done   # "cloud-init tamam: ..." görmelisin
docker compose version
sudo fail2ban-client status sshd
ls -la /etc/ssl/cloudflare/   # bagajpark.crt (644) + bagajpark.key (600) OTOMATİK burada olmalı
systemctl is-active amazon-ssm-agent crond   # ikisi de active
```

### 3. DNS'i güncelle (EIP her `destroy`+`apply`'da DEĞİŞİR)

`stack` her `destroy`+`apply` edildiğinde yeni bir Elastic IP allocation'ı oluşur — eski IP
kaybolur. Cloudflare'de **`bagajpark.com` ve `www`** A kayıtlarını yeni
`terraform output public_ip` değerine **elle** güncellemek gerekir (Proxied/turuncu bulut
açık kalsın). Otomatik değil; Cloudflare API token'ı bu projede yok. Hesap taşımasında
EIP transferi ile adres korunabilir (§ Hesap taşımaları).

> Bu artık canlı alan adıdır: adım atlanırsa site DNS düzeyinde erişilemez kalır.

### 4. Uygulamayı yerleştir (ilk kurulum)

Elle kopyalama gerekmez. Sırlar zaten SSM'deyse (`ops/SECRETS.md`) ilk deploy'u
tetiklemek yeter:

```bash
gh workflow run CI --ref main     # ya da main'e bir merge
```

`deploy` job'ı `docker-compose.yml`, `public/`, `scripts/`, `nginx/conf.d/` ve
`ops/secrets.manifest`'i S3 üzerinden `/opt/emanetci`'ye taşır, `docker-compose.env`'i
SSM'den üretir, `up -d` ve `nginx -t` koşar. Sonra:

- Crontab: deploy `ops/crontab.prod`'u taşımaz; dosyayı sunucuya kopyalayıp başındaki
  KURULUM adımlarını izleyin (önce `mkdir -p /opt/emanetci/logs`).
- Doğrulama: `curl -s https://bagajpark.com/api/health/live`, ertesi gün
  `/api/health/jobs` → `scheduledJobs`.

Veri taşınıyorsa geri yükleme `ops/README.md` § Yedek ve geri yükleme.

## Medya bucket'ı (dükkan fotoğrafları)

`bagajpark-media-7bec61c6` (hesap3; `stack/variables.tf` → `media_bucket_name`).
Yalnızca `shops/*` herkese okunur, uygulama rolü `write-shop-media` ile yazar/siler,
statik anahtar yok. Kod `stack/main.tf`'te (`aws_s3_bucket.media` ve ilgili kaynaklar).
Bucket ilk kez CLI ile kurulduysa `plan` drift göstermemesi için state'e alınır:

```bash
cd infra/aws/stack && terraform workspace select hesap3
terraform state list | grep media        # boşsa aşağıdaki import'lar
B=bagajpark-media-7bec61c6
terraform import aws_s3_bucket.media $B
terraform import aws_s3_bucket_ownership_controls.media $B
terraform import aws_s3_bucket_public_access_block.media $B
terraform import aws_s3_bucket_server_side_encryption_configuration.media $B
terraform import aws_s3_bucket_policy.media_public_read $B
terraform import aws_iam_role_policy.app_media_write bagajpark-aws-test-app-role:write-shop-media
```

Uygulama ayarları SSM'de (`/bagajpark/env/app/S3_BUCKET`, `S3_REGION`); vitrin
fotoğraflarının adresi `S3_PUBLIC_BASE_URL` GitHub değişkeninden imaja da gömülür.

## Maliyet

- **Free Plan hesap kısıtı** (ilk hesapta 2026-08-21'de ölçüldü; canlı hesabın planı ve
  kalan kredisi her sabah gelen maliyet e-postasında, `scripts/README.md` § Günlük AWS maliyet
  raporu): EC2 API sadece `free-tier-eligible=true` instance tiplerini kabul ediyor (`aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true`).
  `t3.medium` reddedildi; `instance_type` varsayılanı `c7i-flex.large` (4GB, x86_64, izinli).
- **Gerçek fiyat (2026-08-29, AWS fiyat listesi, eu-central-1, Linux on-demand):**
  `c7i-flex.large` **$0.09676/saat = ~$70.63/ay**. Aynı listedeki free-tier-eligible alternatifler:

  | Tip | vCPU / RAM | Mimari | $/saat | ~$/ay |
  |---|---|---|---|---|
  | `t4g.micro` | 2 / 1 GiB | arm64 | 0.00960 | 7.01 |
  | `t3.micro` | 2 / 1 GiB | x86_64 | 0.01200 | 8.76 |
  | **`t4g.small`** | 2 / 2 GiB | arm64 | 0.01920 | **14.02** |
  | **`t3.small`** | 2 / 2 GiB | x86_64 | 0.02400 | **17.52** |
  | `c7i-flex.large` (şu anki) | 2 / 4 GiB | x86_64 | 0.09676 | **70.63** |
  | `m7i-flex.large` | 2 / 8 GiB | x86_64 | 0.11471 | 83.74 |

  Ölçülen gerçek kullanım (canlı kutu, 2026-08-29): yük ortalaması **0.19** (2 vCPU'nun
  ~%10'u), konteynerlerin toplam belleği **~424 MiB**, `free -m` → 3819 MB'ın 913 MB'ı
  kullanımda. Yani 4 GiB / tam CPU'nun neredeyse tamamı boşta duruyor.
- **Public IPv4 ücretlidir ve free tier'ı yoktur**: $0.005/saat = ~$3.65/ay. Elastic IP
  yerine otomatik atanan IP kullanmak bir şey kazandırmaz — ikisi de aynı ücrete tabi,
  dolayısıyla EIP'yi (sabit adres) tutmak doğru tercih.
- **Instance'ı durdurmak bir seçenek değil** — bu makine canlıyı sunuyor; `stop-instances`
  siteyi kapatır.
- Bütçe alarmı `bootstrap/budget.tf` ile kuruluyor. **Eşik kodda `monthly_budget_usd`
  değişkenidir (varsayılan 25 USD)**; uygulanan değer repodan doğrulanamaz. Gerçeği
  okumak (salt okunur):
  ```bash
  aws budgets describe-budgets --profile personal-prod \
    --account-id "$(aws sts get-caller-identity --profile personal-prod --query Account --output text)" \
    --query 'Budgets[].{ad:BudgetName,limit:BudgetLimit.Amount}'
  ```
  Çıkan değer `monthly_budget_usd` ile aynı değilse, bir sonraki `apply` onu sessizce
  değiştirir — önce hangisinin doğru olduğuna karar verin.
- `budget_alert_email` boş bırakılırsa bütçe kaynağı hiç oluşturulmaz (`count = 0`), yani
  alarm da olmaz. E-posta kodda gömülü değildir, `-var` ile verilir.
- Kredi biterse hesap kapanır; harcamayı Billing → Cost Explorer'dan düzenli kontrol edin.

## Söküm

> **🚨 `stack/` CANLI ORTAMDIR.** `hesap3` workspace'inde `terraform destroy`, EC2'yi ve
> Elastic IP'yi silerek `bagajpark.com`'u kapatır; **veritabanı da o instance'ın diskinde
> durduğu için veri kaybı demektir**. Yedekler S3'te (`bootstrap/` sağ kalır) ama geri
> yükleme elle yapılır. Aşağıdaki komut yalnızca boşaltılan eski bir hesap ya da kasıtlı bir
> yeniden kurulum için anlamlıdır. Çalıştırmadan önce: `terraform workspace show`.

```bash
cd infra/aws/stack
terraform destroy -var="allowed_ssh_cidr=<senin-ip>/32"
# bootstrap/ dokunulmaz — S3 backup bucket ve SSM'deki TLS materyali sağ kalır
# (2026-08-21'de fiilen doğrulandı: destroy sonrası terraform state list boş,
# ama bootstrap'taki S3/SSM kaynakları head-bucket/describe-parameters ile sağlam çıktı)
```

## Taşınabilirlik (hesap/kredi değişirse)

Hesap ID'si ve bölgeye özel kaynak ID'si hiçbir dosyada hardcode edilmez (AMI `data`
kaynağıyla sorgulanır). **İstisnalar `stack/variables.tf` → `deploy_config_bucket` ve
`media_bucket_name`**: bucket adları `random_id` içerdiği için isimlendirme sözleşmesiyle
bağlanamıyor, varsayılan olarak yazılıdır ve hesap değişiminde elle güncellenmelidir
(2026-08-23'te unutuldu). Aynısı `ops/crontab.prod`'daki yedek bucket'ı için de geçerli.
Uçtan uca sıra aşağıda § Hesap taşımaları. Terraform tarafı:

1. Yeni hesapta `aws configure --profile <yeni-profil>` yap, "IAM kullanıcı yetkileri"
   bölümündeki policy'leri yeni kullanıcıya da ekle
2. `bootstrap/` içinde `-var="aws_profile=<yeni-profil>"` ile tekrar `apply` (yeni, farklı
   isimli bir S3 bucket oluşur — `random_id` sayesinde çakışma olmaz; TLS cert/key yerel
   dosyadan tekrar okunup yeni hesabın SSM'ine yazılır)
3. Eski bucket'tan yeniye veri taşımak istersen: `aws s3 sync s3://eski-bucket
   s3://yeni-bucket --profile eski-profil` (iki profilin de aynı anda yapılandırılmış
   olması gerekir)
4. `stack/` içinde aynı şekilde `-var="aws_profile=<yeni-profil>"` ile `apply`

## Hesap taşımaları

> **`<ORIGIN_IP>` nedir:** origin sunucunun public IP'si bilerek repoya yazılmıyor.
> `bagajpark.com` Cloudflare arkasında ve güvenlik grubu 80/443'ü yalnızca Cloudflare
> edge aralıklarına açıyor (`infra/aws/stack/main.tf`); origin adresini dokümana gömmek o
> korumanın etrafından dolaşmayı kolaylaştırır. Güncel değeri AWS'ten okuyun:
>
> ```bash
> aws ec2 describe-addresses --profile personal-prod --region eu-central-1 \
>   --query 'Addresses[].PublicIp' --output text
> ```

### Son taşıma — 2026-10-25 (doğrulama 2026-11-23)

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

### Geçmiş

| Tarih | Ne |
|---|---|
| 2026-08-23 | Hetzner → AWS (hesap 269174115166 → aynı gün 772853132412). Kesim ~7 dk; son dump 19 rezervasyon / 39 kullanıcı / 3 dükkan. Hetzner trafiksiz bırakıldı; aboneliğin iptali sahibine bırakıldı |
| 2026-08-29 | Kesim sonrası sapmalar kapandı: betiklerin varsayılan dizini `/root/emanetci` → `/opt/emanetci`, Terraform profil/workspace varsayılanları, TLS dosya adı (`aws-test.*` → `bagajpark.*`), sırlar SSM'e (`ops/SECRETS.md`), crontab repoya (`ops/crontab.prod`) |
| 2026-10-25 | 772853132412 → 710882445040 (yukarıda). Sebep: eski hesabın Free plan kredisi bitmek üzereydi; kredi bitince hesap kapanır |

### Bir sonraki taşıma için kontrol listesi

İki taşımada da işe yarayan sıra. Komutlar `ops/README.md` (yedek/geri yükleme) ve
bu belgenin Terraform bölümlerinde.

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

## Bilinen sınırlamalar

- **State local'de tutulur** (S3 backend yok) — sadece bu makineden `apply`/`destroy`
  edilebilir. Tek geliştirici için kabul edilebilir; ekip büyürse S3+DynamoDB backend'e
  geçilmeli. State dosyaları git'e girmez (`.gitignore` → `infra/**/*.tfstate*`).
- **Elastic IP her `stack` yeniden kurulduğunda değişir** — DNS güncellemesi elle.
- `docker-compose.env` Terraform'a hiç girmez — değerler SSM'de, dosya deploy'da üretilir.

## Ölçekleme yolu

(2026-11-23: eski `docs/SCALING.md`'nin — self-hosted / Vercel karşılaştırması ve 10k/100k
kullanıcı boyutlandırması — karar ve yol kısmı buraya alındı; karar verilmiş olduğu için
karşılaştırma kısmı çıkarıldı.)

**Karar: self-hosted, tek kutu.** Uygulama, Postgres, Redis ve nginx aynı EC2'de Docker
Compose ile koşar; Cloudflare önde (TLS, CDN, WAF). 2026-08-29 ölçümü: yük ortalaması ~0.19,
konteynerler toplam ~424 MiB — kutu büyük ölçüde boşta (yukarıdaki Maliyet).

Kayıtlı kullanıcı sayısı değil **eşzamanlı istek** zorlar. Metrikler (CPU, p95, bağlantı
sayısı) eşiği aşınca sırayla:

| Adım | Ne | Ne zaman |
|---|---|---|
| 1 | Postgres'i ayrı/managed instance'a al (RDS vb.), `pg_stat_statements` ile yavaş sorgular | DB CPU/disk kutuyu zorladığında; ayrıca tek kutu = tek arıza noktası |
| 2 | Bağlantı havuzu (PgBouncer, transaction mode) | Uygulama replica'sı birden fazla olunca |
| 3 | Aynı imajdan N `web` replica, önde yük dengeleyici | Uygulama CPU'su darboğaz olunca |
| 4 | Redis'i önbellek + kuyruk için de kullan (bugün yalnızca rate limit) | Bildirim/webhook yoğunluğu artınca |
| 5 | Okuma replica'sı, eski rezervasyonlar için arşiv/partition | `Booking`/`PaymentLog` milyon satıra yaklaşınca |

Kabaca bantlar (load test ile doğrulanmadı): ~10k misafir / ~1k esnaf bugünkü tek kutu +
ayrı DB ile; ~100k / ~10k için 4–8 vCPU / 16–32 GB DB, 4–8 uygulama replica'sı, Redis
kuyruğu ve APM (`docs/GUVENLIK_VE_IZLEME.md`). Yük testi araçları: `tests/stress/README.md`.
