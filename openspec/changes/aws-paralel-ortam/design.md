## Context

Hetzner sunucusundaki `docker-compose.yml` toplam bellek limiti (`redis 96m + srh 64m +
postgres 512m + web 1536m + nginx 128m`) ≈ **2.3GB**. Bu, minimum 4GB RAM'lik bir instance
gerektiriyor (`t3.medium`) — `t2/t3.micro` (1GB) stack'i taşıyamaz. $45 bütçeyle 7/24 bir
`t3.medium` (~$30/ay on-demand, bölgeye göre değişir) yaklaşık **6 hafta** sürer; bu yüzden
"7/24 mirror" değil "gerektiğinde aç/kapat" bir model tasarlanıyor.

Hesabın 12 aylık klasik ücretsiz kotaya (2025-07-15 öncesi hesap) mı yoksa yalnız $45'lik
kredi havuzuna mı tabi olduğu **Faz 0'da netleşecek** (Billing → Free Tier sayfası) — bu,
instance boyutu/kullanım disiplini kararını değiştirir.

## Goals / Non-Goals

**Goals:**
- Aynı uygulamayı AWS'de, Terraform ile, tekrarlanabilir şekilde ayağa kaldırabilmek
- $45 krediyi haftalar içinde tüketmemek
- Kredi/hesap değişse aynı kodun yeni bir hesaba taşınabilmesi
- Root AWS credential'ının hiçbir zaman sohbete veya repoya girmemesi

**Non-Goals (bu faz için):**
- RDS/ElastiCache gibi yönetilen servislere geçiş — ek billable servis = daha hızlı kredi
  tükenimi; ileride ayrı bir öneri olarak değerlendirilebilir, bu değişiklik kapsamında değil
- Yüksek erişilebilirlik / multi-AZ / load balancer — deneysel, tek kullanıcılı bir ortam
- Terraform remote state (S3 backend + DynamoDB lock) — tek kişi, tek makine; local state
  yeterli, `[[iac-quality]]` prensibinin "remote state" gereksinimi burada orantısız

## Decisions

### 1. Mimari: "aynısını kopyala", yönetilen servislere geçme
**Karar**: Tek EC2 instance, aynı `docker-compose.yml` (Hetzner'deki dosyanın birebir
kopyası, sadece `.env` farklı — farklı `AUTH_SECRET`, farklı domain).
**Neden**: Kullanıcının isteği "aynısını AWS'te çalıştırmaya çalışacağız" — RDS/ElastiCache
gibi ayrıştırılmış servisler her biri kendi başına ücretlendirilir, $45'i çok daha hızlı
tüketir ve Terraform karmaşıklığını artırır. Tek instance en ucuz, en basit, en hızlı
kurulan seçenek.
**Alternatif (şimdilik reddedildi)**: RDS (PostGIS destekliyor) + ElastiCache — "gerçek AWS
native mimari" öğrenmek isteniyorsa ileride ayrı bir faz/öneri olarak ele alınabilir.

### 2. Instance boyutu ve çalışma disiplini
**Karar**: `t3.medium` (4GB RAM — stack'in ihtiyacını tam karşılıyor), **on-demand**, ama
**7/24 açık tutulmuyor**. Kullanım deseni: test edilecekse `terraform apply` (veya sadece
`aws ec2 start-instances`), iş bitince `aws ec2 stop-instances` (compute ücreti kesilir,
sadece EBS depolama ~cent seviyesinde devam eder).
**Neden**: $45 / (~$0.0416-0.05/saat bölgeye göre) ≈ 900-1000 saat — günde 2-3 saatlik
test kullanımıyla aylarca yeter; 7/24 açık bırakılırsa 6 haftada biter.
**Alternatif (değerlendirildi, ertelendi)**: Spot instance (~%70 daha ucuz) — kesinti riski
bu deneysel ortam için kabul edilebilir olsa da, Terraform'da spot request karmaşıklığı
ilk kurulum için gereksiz; stop/start disiplini tek başına yeterli tasarruf sağlıyor.
İstenirse Faz sonrası bir iyileştirme olarak eklenebilir.
**Güvenlik ağı**: AWS Budgets ile $10/$25/$40 eşiklerinde email alarmı — instance
kapatmayı unutursa bile sürpriz olmaz.

### 3. IAM: root kullanılmaz, credential sohbete girmez
**Karar**: Kullanıcı kendi tarayıcısında AWS Console'a root ile giriş yapar, IAM'de
`terraform-bagajpark` adlı bir kullanıcı oluşturur (programatik erişim, scoped policy —
EC2/VPC/S3/IAM-kendi-kapsamı ile sınırlı, `AdministratorAccess` değil), access key üretir.
Ardından **kendi terminalinde** `aws configure --profile bagajpark` çalıştırır — access
key/secret hiçbir zaman bana (asistana) yapıştırılmaz, benim çalıştırdığım bir komuta
argüman olarak geçmez. Ben sadece `aws sts get-caller-identity --profile bagajpark` gibi
credential'ı asla yazdırmayan doğrulama komutları çalıştırırım.
**Neden**: `[[creds-access]]` prensibinin AWS karşılığı — secret hiçbir zaman terminal
çıktısında, sohbet geçmişinde veya bir dosyada açık durmamalı.

### 4. Terraform state: local, iki ayrı kök
**Karar**: `infra/aws/bootstrap/` (IAM kullanıcı + S3 bucket — nadiren değişir, kalıcı) ve
`infra/aws/stack/` (VPC + EC2 + SG — sık `apply`/`destroy` edilir) **ayrı state dosyaları**.
**Neden**: Ana stack'i `destroy` ederken backup bucket'ının veya IAM kullanıcısının
yanlışlıkla silinmemesi gerekiyor — `[[managed-service-ownership]]`'daki "blast radius
ayrımı" prensibinin burada karşılığı. Local state (S3 backend değil) çünkü tek kişi/tek
makine; state dosyaları `.gitignore`'a eklenir, asla commit edilmez (secret + kaynak ID'leri
içerir).

### 5. Taşınabilirlik (hesap değişirse)
**Karar**: `variables.tf`'te hesaba özel hiçbir şey hardcode edilmez (region, AMI ID'si
`data "aws_ami"` ile bölgeden bağımsız sorgulanır, key-pair adı değişken). Yeni bir
free-tier hesaba geçişte: yeni hesapta `bootstrap` kökü tekrar `apply` edilir (yeni IAM
kullanıcı + yeni S3 bucket, ya da eski bucket'tan `aws s3 sync` ile veri taşınır), sonra
`stack` kökü aynı kodla `apply` edilir.
**Not**: S3 bucket adları global-unique olduğundan yeni hesapta otomatik olarak yeni bir ad
üretilecek (`variables.tf`'te `bucket_suffix` gibi bir değişkenle, örn. `random_id`
kaynağı) — kod değişmeden farklı hesaplarda farklı bucket adı alınabilmesi için.

### 6. TLS materyali: SSM Parameter Store + EC2 IAM role (2026-08-21)
**Karar**: Cloudflare Origin Certificate (`.crt`/`.key`) yerel diskte loose dosya olarak
durmak yerine `bootstrap/`'ta `aws_ssm_parameter` (SecureString) olarak saklanıyor;
`stack/`'teki EC2 kendi IAM role'üyle (sadece bu iki parametreye `ssm:GetParameter` +
`kms:Decrypt`) bunu ilk boot'ta cloud-init içinde otomatik çekiyor.
**Neden**: Kullanıcının açık isteği — "bootstrap tarafı düzgün olsun ki kapatıp başka yerde
açmak zorunda kalırsak sorun yaşamayalım... sertifikaları da güzelce bir yerlere koy". Manuel
`scp` ile sertifika taşıma hem tekrarlanamaz (as-code değil) hem de her `stack` yeniden
kurulduğunda unutulabilecek bir adımdı.
**Sonuç**: `terraform-bagajpark` kullanıcısının yetkileri EC2/VPC/S3 FullAccess'in üzerine
genişletildi (SSM+KMS+scoped IAM role/instance-profile — tam liste
`infra/aws/README.md#iam-kullanıcı-yetkileri`'nde). Bu genişletme kendi başına bir
gözlem: "least privilege" hedefi ile "gerçekten çalışan otomasyon" hedefi sürekli gerilimde
— her yeni kaynak türü (SSM, IAM role) kendi ek izinlerini gerektirdi, üç ayrı `AccessDenied`
hatasıyla (PutParameter, DescribeParameters, TagInstanceProfile) keşfedildi.
**Doğrulama**: `stack` tamamen `destroy` edilip sıfırdan `apply` edildi — yeni instance,
cloud-init SSM'den cert/key'i sorunsuz çekti, dosya boyutu/izin/tarih ilk kurulumla birebir
eşleşti, manuel adım sıfır.
**Bilinen sınırlama**: Elastic IP her `apply`'da değişiyor (yeni allocation), bu yüzden DNS
kaydı hâlâ elle güncelleniyor — TLS kadar "as code" değil. Route53/Cloudflare API
entegrasyonu ile kapatılabilir, bu iterasyonun kapsamı dışında bırakıldı.

## Risks / Trade-offs

- Local state → başka bir makineden `apply` edilemez; tek geliştirici için kabul edilebilir,
  not olarak `infra/aws/README.md`'ye yazılacak.
- Stop/start disiplini insana bağlı → unutulursa Budgets alarmı devreye girer ama parayı
  geri getirmez; ilk kurulumda alarm eşiklerinin gerçekten çalıştığı test edilecek (test
  bildirimi gönderme özelliği AWS Budgets'te var).
- `t3.medium` yine de tam Hetzner paritesinde değil (network/disk I/O farklı) — bu bir
  performans testi değil, "aynı stack AWS'de ayağa kalkar mı" doğrulaması.
- Hesabın 12-ay-kotalı mı yoksa $45-kredili mi olduğu netleşene kadar kesin maliyet
  tahmini kesinleşmez — Faz 0'ın çıktısı bu belirsizliği kapatacak.

## Migration Plan

Faz sırası `tasks.md`'de; `bootstrap` her zaman `stack`'ten önce, `stack` içindeki her
`destroy` sonrası `bootstrap` kaynaklarının (S3 bucket, IAM kullanıcı) sağ kaldığı ayrıca
doğrulanacak.
