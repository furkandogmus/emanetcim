## 0. Hesap Keşfi ve Güvenlik Ağı (para harcamadan önce)

- [x] 0.1 `aws freetier get-account-plan-state` ile teyit edildi (2026-08-21): hesap
      `269174115166`, `accountPlanType: FREE`, kalan kredi **$47.53**, bitiş
      **2027-01-07**. Kredi bazlı model — 12 aylık klasik kota yok.
- [x] 0.2 Mevcut `My Monthly Cost Budget` ($100/ay, %85/%100 eşik) kredi havuzunu
      korumuyordu (85'i $47.53'ten büyük, hiç tetiklenmezdi). Ek bütçe oluşturuldu:
      `bagajpark-aws-test-guardrail`, $40/ay limit, %25/%50/%80 gerçek + %100 tahmini
      harcamada `furkandogmus9183@gmail.com`'a email (2026-08-21).
- [ ] 0.3 İlk gerçek harcama gerçekleştiğinde (Faz 2 EC2 apply sonrası) bir eşiğin
      gerçekten email'e düştüğünü doğrula (AWS Budgets CLI'dan senkron test bildirimi
      göndermiyor, ilk gerçek tetiklemeyle doğrulanacak)
- [x] 0.4 IAM kullanıcı `terraform-bagajpark` oluşturuldu (2026-08-21), üç managed policy
      attached: `AmazonEC2FullAccess`, `AmazonVPCFullAccess`, `AmazonS3FullAccess` —
      `AdministratorAccess` DEĞİL
- [x] 0.5 Access key üretildi, kullanıcı kendi terminalinde `aws configure --profile
      bagajpark` çalıştırdı (region: `eu-central-1`)
- [x] 0.6 Doğrulandı: `aws sts get-caller-identity --profile bagajpark` →
      `terraform-bagajpark` kullanıcısı, hesap `269174115166`

## 1. Terraform İskeleti

- [x] 1.1 `infra/aws/bootstrap/` — `providers.tf` (aws ~>5.0, random ~>3.6),
      `variables.tf` (`region`, `random_id.bucket_suffix`)
- [x] 1.2 `infra/aws/bootstrap/main.tf` — S3 bucket + versioning + encryption + public
      access block + lifecycle (noncurrent versiyonlar 90 gün sonra silinir, güncel
      objeler asla otomatik silinmez). IAM kullanıcısı Terraform'a devredilmedi, elle
      oluşturulmuş haliyle kaldı (bilinçli karar — Terraform importu bu faz kapsamı dışı).
- [x] 1.3 `infra/aws/stack/` — `providers.tf`, `variables.tf` (region, instance_type,
      ssh_port, allowed_ssh_cidr — hardcode account ID yok)
- [x] 1.4 `infra/aws/stack/main.tf` — VPC (10.20.0.0/16, tek public subnet), IGW, route
      table, security group (80/443/2222 — 22 kapalı), EC2, Elastic IP. AMI: Amazon Linux
      2023 (Rocky değil — data source güvenilirliği için tercih edildi, Docker zaten
      dağıtımdan bağımsız)
- [x] 1.5 `.gitignore`'a `infra/**/.terraform/`, `*.tfstate*`, `*.tfvars` eklendi.
      `.terraform.lock.hcl` KASITLI olarak commit ediliyor (pinned provider version).
- [x] 1.6 `terraform fmt` + `terraform validate` — her iki kökte de temiz (bir uyarı
      düzeltildi: `aws_s3_bucket_lifecycle_configuration` için boş `filter {}` eklendi)
- [x] 1.7 `infra/aws/README.md` — kurulum, apply/destroy sırası, local-state uyarısı,
      maliyet disiplini, taşınabilirlik adımları

## 2. İlk Apply (küçük, geri alınabilir adımlarla)

- [x] 2.1 `bootstrap` apply edildi (2026-08-21) — bucket `bagajpark-backups-43403243`
- [x] 2.2 `stack` apply edildi (2026-08-21), üç deneme gerekti, her biri gerçek AWS
      kısıtlarını ortaya çıkardı:
      - SG description'da `'` (apostrof) → AWS'nin izin verdiği karakter setinde değil,
        description düzeltildi
      - AL2023 AMI snapshot'ı 20GB root volume'a sığmadı ("expect size >= 30GB") →
        `root_volume_gb` varsayılanı 30'a çıkarıldı
      - **Önemli bulgu**: bu hesap "Free Plan" (kredi bazlı) olduğundan EC2 API sadece
        `free-tier-eligible=true` instance tiplerini kabul ediyor — `t3.medium` API
        seviyesinde reddedildi. `aws ec2 describe-instance-types --filters
        Name=free-tier-eligible,Values=true` ile izinli liste çıkarıldı:
        `t3.micro`/`t4g.micro` (1GB), `t3.small`/`t4g.small` (2GB), **`c7i-flex.large`
        (4GB, x86_64)**, `m7i-flex.large` (8GB, x86_64) — `instance_type` varsayılanı
        `c7i-flex.large` olarak güncellendi (design.md'nin öngördüğü 4GB ihtiyacını
        karşılıyor ve izinli listede)
      - Sonuç: `instance_id=i-0dd5b045d9db690cb`, `public_ip=63.186.147.198`
- [x] 2.3 SSH ile bağlanıldı, doğrulandı: Docker 25.0.14, Docker Compose v5.5.0,
      `fail2ban-client status sshd` → jail doğru portu (2222) izliyor, `ss -tlnp` → sadece
      2222'de dinliyor (22 tamamen kapalı)
- [x] 2.4 `docker-compose.yml` `scp` ile `/opt/emanetci`'ye taşındı (rsync AL2023'te
      kurulu değil, scp kullanıldı). Minimal `docker-compose.env`: yeni `openssl rand
      -base64 32` ile üretilmiş `AUTH_SECRET`, `AUTH_PUBLIC_HOST`/`NEXT_PUBLIC_APP_URL` =
      EIP. Google OAuth ve diğer opsiyonel anahtarlar boş (bu test için gerekmiyor).
- [x] 2.5 `docker compose up -d postgres redis srh web` (nginx HARİÇ — TLS cert yok, bkz.
      2.6). Doğrulama: `docker compose ps` → dördü de `healthy`/`running`,
      `docker compose exec web node -e "fetch(...)"` → `{"status":"ok","live":true,...}`
      (2026-08-21). **Aynı stack AWS'de eksiksiz çalışıyor.**
- [x] 2.6 nginx + TLS + public erişim tamamlandı (2026-08-21):
      - Cloudflare'de `aws-test.bagajpark.com` A kaydı → `63.186.147.198`, **Proxied**
        (turuncu bulut)
      - Origin cert (`aws-test.crt`/`.key`, kullanıcı Cloudflare dashboard'dan üretti,
        secret hiçbir zaman sohbete girmedi) → `/etc/ssl/cloudflare/` üzerinde
      - `nginx/conf.d/{00-map,01-hardening}.conf` repo'dan aynen kopyalandı;
        `default.conf`'un `aws-test` sürümü (server_name + cert yolu uyarlanmış) yazıldı
      - `nginx -t` başarılı, `docker compose up -d nginx` ile ayağa kalktı
      - **Doğrulama**: `https://aws-test.bagajpark.com/api/health/live` →
        `{"status":"ok","live":true,...}` (Cloudflare edge sertifikası üzerinden, gerçek
        tarayıcı senaryosu)
      - Not: Cloudflare Origin Certificate'lar SADECE Cloudflare proxy'si (turuncu bulut)
        arkasında güvenilir — DNS-only (gri bulut) ile doğrudan origin'e bağlanan istemci
        "unable to get local issuer certificate" hatası alır (tasarım gereği, bug değil)

## 3. Maliyet Disiplini

- [ ] 3.1 Test oturumu bitince `aws ec2 stop-instances --profile bagajpark ...`
      çalıştırıldığını doğrula (kapanma sonrası `aws ec2 describe-instances` ile `stopped`
      durumu teyit)
- [ ] 3.2 Bir hafta sonra Billing → Cost Explorer'dan gerçek harcamayı kontrol et, tahminle
      karşılaştır
- [ ] 3.3 Karar: instance'ı tamamen `terraform destroy` mı edelim yoksa `stopped` mı
      bırakalım (EBS depolama maliyeti çok küçük ama sıfır değil)

## 4. Taşınabilirlik Doğrulaması

- [x] 4.1 **TLS materyali "as code" hale getirildi** (2026-08-21, kullanıcı isteği: "bootstrap
      düzgün olsun ki kapatıp başka yerde açmak zorunda kalırsak sorun yaşamayalım"):
      - `bootstrap/`'a `aws_ssm_parameter.tls_cert`/`tls_key` eklendi (SecureString, KMS ile
        şifreli, `sensitive()` ile plan/apply çıktısında hiçbir zaman açık yazılmıyor)
      - `stack/`'e EC2 için `aws_iam_role` + `aws_iam_role_policy` (sadece
        `ssm:GetParameter` + `kms:Decrypt` via `kms:ViaService=ssm.*`, sadece bu iki
        parametreye scoped) + `aws_iam_instance_profile` eklendi
      - `cloud-init.sh.tftpl` artık AWS CLI'ı kurup (AL2023'te hazır gelmiyor) SSM'den
        cert+key'i **instance'ın kendi rolüyle** çekiyor — statik AWS key sunucuya hiç
        konmuyor, manuel `scp` bir daha gerekmiyor
      - Gerekti: `terraform-bagajpark` kullanıcısına ek scoped izinler (`ssm:PutParameter`
        vb. `/bagajpark/*` prefix'i altında, `ssm:DescribeParameters` — AWS kısıtı,
        resource-level ARN desteklemiyor, `Resource:"*"` gerekiyor —, `kms:Decrypt/Encrypt`
        via `ssm.*.amazonaws.com`, ve `bagajpark-aws-test-*` isimli IAM role/instance-profile
        için create/tag/pass/list-policy izinleri) — hepsi root ile, ayrı `put-user-policy`
        çağrılarıyla eklendi
- [x] 4.2 **Gerçek taşınabilirlik testi yapıldı** (2026-08-21): `stack` kökü tamamen
      `terraform destroy` edildi (`terraform state list` boş döndü), `bootstrap`'taki S3
      bucket (`head-bucket` ile doğrulandı) ve SSM parametreleri (`describe-parameters` ile
      doğrulandı) **sağ kaldı** — blast-radius ayrımı tasarımı gerçekten çalışıyor.
      Ardından `stack` sıfırdan `apply` edildi (yeni `instance_id`, yeni `public_ip`):
      cloud-init ilk boot'ta TLS materyalini SSM'den otomatik çekti (dosya boyutu/izinler/
      sertifika tarihleri ilk kurulumla birebir eşleşti, hiçbir manuel adım yok), uygulama
      yeniden `scp` ile taşındı (docker-compose.yml/.env/nginx — bu kısım henüz otomatik
      değil, bilinen sınırlama), `https://aws-test.bagajpark.com/api/health/live` DNS
      güncellendikten sonra tekrar `{"status":"ok","live":true}` döndürdü.
      **Not**: Elastic IP her `stack` yeniden kurulduğunda DEĞİŞİYOR (yeni allocation) —
      DNS kaydının elle güncellenmesi gerekiyor, otomatik değil. Bilinen sınırlama, gelecekte
      Route53/Cloudflare API entegrasyonuyla otomatikleştirilebilir.
- [ ] 4.3 (opsiyonel, henüz yapılmadı) Aynı kodu farklı bir `region` değişkeniyle tekrar
      `apply` ederek "hesaba/bölgeye özel hardcode yok" iddiasını ayrıca sına
