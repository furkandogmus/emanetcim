# AWS — **canlı** ortam (Terraform)

> **Bu dizin artık bir test ortamını değil, canlı `bagajpark.com`'u tarif ediyor.**
> 2026-08-23 kesimiyle uygulama Hetzner'den AWS EC2'ye taşındı; ardından hesap
> değişikliği yapıldı. Kesim kaydı ve son durum: [`CUTOVER.md`](./CUTOVER.md).
> Bu dosya 2026-08-29'da güncellendi — o tarihe kadar hâlâ "AWS = Hetzner'in
> önündeki doğrulama kapısı, `aws-test.bagajpark.com`" diyordu ve bu **yanlıştı**
> (düzeltilmesi gerektiği `CUTOVER.md` 5. bölümde açık iş olarak duruyordu).

Bağlı olduğu değişiklik önerisi: `openspec/changes/aws-paralel-ortam/` — orası ortamın
**nasıl kurulduğunun** kaydıdır (tasks.md: ne yapıldı, hangi sırayla, hangi hatalarla).
Ortamın bugünkü rolü burada ve `CUTOVER.md`'de yazar.

## İsimler yalan söylüyor — bilerek değiştirilmedi

Terraform kaynak adları, SSM önekleri ve bütçe adı hâlâ `aws-test` içeriyor
(`bagajpark-aws-test-*`, `/bagajpark/aws-test/tls`). Ortam test değil, canlı.
**Yine de yeniden adlandırılmadı**, çünkü:

- `.github/workflows/ci.yml` deploy job'ı hedef sunucuyu `tag:Project=bagajpark-aws-test`
  ile seçer. Ad değişirse deploy hedefi bulamaz.
- IAM rol / instance profile / EIP adları bu önekten türüyor; değiştirmek kaynakların
  yeniden yaratılması, yani **canlı kesinti** demektir.

Adı okurken "test" değil "bu projenin AWS ortamı" diye okuyun. Değişkenin kendisinde de
aynı not duruyor (`stack/variables.tf` → `project_name`).

## Deploy politikası (2026-08-23 kesiminden itibaren)

**`main`'e push = canlıya deploy.** Ayrı bir doğrulama ortamı ARTIK YOK.

| Ne | Ne zaman | Nasıl |
|----|----------|-------|
| Canlı (`bagajpark.com`) | `main`'e her push'ta, otomatik | `.github/workflows/ci.yml` → `verify` → `image` → `deploy` (GitHub OIDC + SSM Run Command, hedef dizin `/opt/emanetci`) |
| Elle güncelleme | CI kullanılamadığında | Sunucuda `cd /opt/emanetci && ./scripts/update.sh` (ya da `./scripts/vm-update.sh`) |

`deploy` job'ı `needs: image`, `image` de `needs: verify` — yani doğrulamadan geçmeyen
bir commit üretime çıkamaz. Ayrıntı: `docs/CI_CD.md`.

Doğrulama ortamı olmadığı için `main`'e doğrudan push riskli: `develop` → PR → `main`
disiplini bu ortamda tek koruma katmanıdır.

### Hetzner

Kesimden sonra trafiksiz kaldı; aboneliğin iptali kullanıcıya bırakıldı
(`CUTOVER.md` 5. bölüm). Bu dosyanın eski sürümündeki "Hetzner canlıdır, AWS
doğrulama kapısıdır" tablosu ve "Hetzner'de elle `update.sh`" akışı **kaldırıldı** —
o makine artık trafik almıyor.

Eski sürümde ayrıca "Hetzner crontab'ının diğer 4 işi (yedekleme, ödeme reconciliation,
disk temizliği, mühür tahmini) çalışmaya devam ediyor" cümlesi vardı. **Bu cümle
silindi**: (a) o makineye ait bir gözlemdi, (b) "mühür tahmini" iddiası tek kaynak olan
`src/lib/jobs/registry.ts` ile çelişiyordu (`seal-forecast` orada `enforced: false`,
"kurulmadı"), (c) "ödeme reconciliation" cron'u 2026-08-22'de kasten kapatılmıştı
(`docs/DEFECT_BACKLOG.md`). Zamanlanmış işlerin tek doğru kaynağı kayıt defteridir;
sunucuda gerçekte ne kurulu olduğu ise yalnızca `crontab -l` ile öğrenilir.

## Neden iki kök var

| Kök | İçerik | Ne sıklıkla değişir |
|-----|--------|----------------------|
| `bootstrap/` | S3 backup bucket'ı, TLS materyali (SSM SecureString) | Neredeyse hiç. `stack/` `destroy` edilse bile bu **sağ kalır** — canlıda doğrulandı (2026-08-21). |
| `stack/` | VPC, EC2, security group, IAM role, Elastic IP | Nadir. **Canlı sunucu burada** — "test bitince söküyoruz" dönemi 2026-08-23 kesimiyle bitti. |

Bu ayrım kasıtlı: `stack/`'i `terraform destroy` ederken backup bucket'ının veya TLS
sertifikasının yanlışlıkla silinmesini engeller.

## Ön koşullar

- `terraform >= 1.9`
- `aws` CLI, **`bagajpark-yeni`** profili yapılandırılmış — canlı hesap (772853132412):
  ```bash
  aws sts get-caller-identity --profile bagajpark-yeni --query Account --output text
  # Beklenen: 772853132412
  terraform workspace show   # Beklenen: hesap2
  ```
  Profil ve workspace BİRLİKTE değişir; ayrışırsa `plan` her kaynağı "to create" gösterir
  (ayrıntı `stack/variables.tf` → `aws_profile` notu). Eski hesap (269174115166) profili
  `bagajpark`, workspace `default` — kapatılıyor.
- `~/.ssh/aws-bagajpark` / `.pub` keypair'i (üretildi, tekrar gerekmez):
  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/aws-bagajpark -N "" -C "aws-bagajpark-test"
  ```
- Kendi public IP'ni öğren (SSH'ı sadece kendine açmak için): `curl -s https://ifconfig.me`
- Cloudflare Origin Certificate — `.crt`/`.key` dosyaları yerelde dursun (varsayılan yol
  `~/Documents/personal/tls/aws-test.{crt,key}`, `bootstrap/variables.tf` →
  `tls_cert_path`/`tls_key_path` ile değiştirilebilir). **Dosya adındaki `aws-test`
  tarihseldir**; ortam artık `bagajpark.com`'u sunuyor. Sertifikanın hangi alan adı için
  düzenlendiği bu repodan doğrulanamaz — aşağıdaki "Bilinen sınırlamalar"da duran nginx
  ↔ cloud-init uyuşmazlığına bakın.
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

### 3. DNS'i güncelle (EIP her `destroy`+`apply`'da DEĞİŞİR)

`stack` her `destroy`+`apply` edildiğinde yeni bir Elastic IP allocation'ı oluşur — eski IP
kaybolur. Cloudflare'de **`bagajpark.com` ve `www`** A kayıtlarını yeni
`terraform output public_ip` değerine **elle** güncellemek gerekir (Proxied/turuncu bulut
açık kalsın). Otomatik değil; Cloudflare API token'ı bu projede yok (`CUTOVER.md`).

> Bu artık canlı alan adıdır: adım atlanırsa site DNS düzeyinde erişilemez kalır.

### 4. Uygulamayı yerleştir (ilk kurulum — sonrası CI'da)

Sıradan deploy'da bu adım GEREKMEZ: `main`'e push → CI, `docker-compose.yml` ve `public/`
dosyalarını S3 üzerinden `/opt/emanetci`'ye senkronlar. Aşağıdakiler yalnızca **sıfırdan
kurulan** bir instance için.

```bash
SSH_PORT=$(terraform output -raw ssh_port)
HOST=$(terraform output -raw public_ip)

scp -i ~/.ssh/aws-bagajpark -P "$SSH_PORT" \
  ../../../docker-compose.yml \
  ec2-user@"$HOST":/opt/emanetci/docker-compose.yml

# docker-compose.env — CANLI değerler. AUTH_SECRET'i YENİDEN ÜRETMEYİN: mevcut
# oturumlar ve token'lar geçersiz olur. Var olan sunucudan taşıyın.
# (Dosya Terraform'a hiç girmez; sır repo/state'e yazılmasın diye elle yönetilir.)
cat > /tmp/docker-compose.env <<'EOF'
AUTH_PUBLIC_HOST=bagajpark.com
NEXT_PUBLIC_APP_URL=https://bagajpark.com
AUTH_TRUST_HOST=true
# AUTH_SECRET, POSTGRES_PASSWORD, RESEND_API_KEY, CRON_SECRET ... —
# tam liste docker-compose.env.example / docker-compose.yml içinde
EOF
scp -i ~/.ssh/aws-bagajpark -P "$SSH_PORT" \
  /tmp/docker-compose.env ec2-user@"$HOST":/opt/emanetci/docker-compose.env
rm /tmp/docker-compose.env

# nginx: üç dosya da repodan aynen gider (default.conf server_name=bagajpark.com)
ssh -i ~/.ssh/aws-bagajpark -p "$SSH_PORT" ec2-user@"$HOST" \
  "mkdir -p /opt/emanetci/nginx/conf.d /opt/emanetci/public"
scp -i ~/.ssh/aws-bagajpark -P "$SSH_PORT" \
  ../../../nginx/conf.d/00-map.conf ../../../nginx/conf.d/01-hardening.conf \
  ../../../nginx/conf.d/default.conf ec2-user@"$HOST":/opt/emanetci/nginx/conf.d/

ssh -i ~/.ssh/aws-bagajpark -p "$SSH_PORT" ec2-user@"$HOST" \
  "cd /opt/emanetci && docker compose --env-file docker-compose.env up -d"
curl -s https://bagajpark.com/api/health/live
```

> **Bu adım bugün olduğu gibi çalışmaz.** `default.conf`
> `/etc/ssl/cloudflare/bagajpark.{crt,key}` bekliyor, cloud-init ise SSM'deki materyali
> `aws-test.{crt,key}` adıyla yazıyor — nginx sertifikayı bulamaz. "Bilinen
> sınırlamalar" bölümündeki nota bakın.

## Maliyet

- **Free Plan hesap kısıtı**: EC2 API sadece `free-tier-eligible=true` instance tiplerini
  kabul ediyor (`aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true`).
  `t3.medium` reddedildi; `instance_type` varsayılanı `c7i-flex.large` (4GB, x86_64, izinli).
- **Gerçek fiyat (2026-08-29, AWS fiyat listesi, eu-central-1, Linux on-demand):**
  `c7i-flex.large` **$0.09676/saat = ~$70.63/ay**. Bu README daha önce "≈ $0.04-0.06/saat"
  diyordu; rakam gerçeğin yarısıydı ve runway hesabını iki katına şişiriyordu.
  Aynı listedeki free-tier-eligible alternatifler:

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
- **Instance'ı durdurmak artık bir seçenek değil** — bu makine canlıyı sunuyor. Eski
  sürümdeki "test bitince `stop-instances`" tavsiyesi kaldırıldı; o komut bugün siteyi
  kapatır.
- Bütçe alarmı `bootstrap/budget.tf` ile kuruluyor. **Eşik kodda `monthly_budget_usd`
  değişkenidir (varsayılan 25 USD)**; bu README daha önce "$40/ay kurulu" diyordu ama
  kod ile belge ayrışmıştı ve hangisinin uygulandığı repodan doğrulanamıyor. Gerçeği
  okumak (salt okunur):
  ```bash
  aws budgets describe-budgets --profile bagajpark-yeni \
    --account-id "$(aws sts get-caller-identity --profile bagajpark-yeni --query Account --output text)" \
    --query 'Budgets[].{ad:BudgetName,limit:BudgetLimit.Amount}'
  ```
  Çıkan değer `monthly_budget_usd` ile aynı değilse, bir sonraki `apply` onu sessizce
  değiştirir — önce hangisinin doğru olduğuna karar verin.
- `budget_alert_email` boş bırakılırsa bütçe kaynağı hiç oluşturulmaz (`count = 0`), yani
  alarm da olmaz. E-posta kodda gömülü değildir, `-var` ile verilir.
- Kredi biterse hesap kapanır; harcamayı Billing → Cost Explorer'dan düzenli kontrol edin.

## Söküm

> **🚨 `stack/` CANLI ORTAMDIR.** `hesap2` workspace'inde `terraform destroy`, EC2'yi ve
> Elastic IP'yi silerek `bagajpark.com`'u kapatır; **veritabanı da o instance'ın diskinde
> durduğu için veri kaybı demektir**. Yedekler S3'te (`bootstrap/` sağ kalır) ama geri
> yükleme elle yapılır. Aşağıdaki komut yalnızca kapatılmakta olan eski hesap
> (workspace `default`, profil `bagajpark`) için ya da kasıtlı bir yeniden kurulum için
> anlamlıdır. Çalıştırmadan önce: `terraform workspace show`.

```bash
cd infra/aws/stack
terraform destroy -var="allowed_ssh_cidr=<senin-ip>/32"
# bootstrap/ dokunulmaz — S3 backup bucket ve SSM'deki TLS materyali sağ kalır
# (2026-08-21'de fiilen doğrulandı: destroy sonrası terraform state list boş,
# ama bootstrap'taki S3/SSM kaynakları head-bucket/describe-parameters ile sağlam çıktı)
```

## Taşınabilirlik (hesap/kredi değişirse)

Hesap ID'si ve bölgeye özel kaynak ID'si hiçbir dosyada hardcode edilmez (AMI `data`
kaynağıyla sorgulanır). **Tek istisna `stack/variables.tf` → `deploy_config_bucket`**:
bucket adı `random_id` içerdiği için isimlendirme sözleşmesiyle bağlanamıyor, varsayılan
olarak yazılıdır ve hesap değişiminde elle güncellenmelidir (2026-08-23'te unutuldu, eski
hesabın bucket'ını gösteriyordu). Yeni bir hesaba geçişte:

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
- **Sertifika dosya adı uyuşmuyor — yeni bir instance TLS'siz açılır.**
  `stack/cloud-init.sh.tftpl` SSM'den çektiği materyali
  `/etc/ssl/cloudflare/aws-test.{crt,key}` olarak yazıyor; repodaki
  `nginx/conf.d/default.conf` ise `/etc/ssl/cloudflare/bagajpark.{crt,key}` bekliyor.
  Bugünkü sunucu çalışıyor çünkü dosyalar oraya elle yerleştirildi — ama `stack`
  yeniden kurulursa nginx sertifikayı bulamadan açılmaz. Düzeltmek için SSM
  parametresindeki sertifikanın hangi alan adına ait olduğunu bilmek gerekiyor; bu
  repodan doğrulanamadığı için bilerek **değiştirilmedi**, kayıt altına alındı
  (`docs/DEFECT_BACKLOG.md`).
- **Sunucudaki crontab repoda yok.** `CUTOVER.md` 3c adımı `/opt/emanetci/crontab.prod`
  dosyasını kuruyor ama o dosya bu repoda hiçbir yerde yok — tek kopyası sunucuda.
  Zamanlanmış işlerin uygulama tarafı `src/lib/jobs/registry.ts`'ten türetilebilir
  (`scripts/emit-crontab.sh`), sunucuya özgü işler (yedekleme, disk temizliği) türetilemez.
