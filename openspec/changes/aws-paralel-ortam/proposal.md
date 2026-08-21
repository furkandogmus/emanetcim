## Why

Kullanıcı, aynı stack'i (Next.js + Postgres/PostGIS + Redis + nginx) AWS üzerinde de
çalıştırmayı deneyimlemek istiyor — mevcut Hetzner sunucusu prod olarak yerinde kalıyor,
bu tamamen paralel/deneysel bir ortam. Gerçek müşteri verisi henüz yok, bu yüzden risk
toleransı yüksek; asıl kısıt **bütçe** ($45 mevcut AWS kredisi) ve **taşınabilirlik**
(kredi bitince veya hesap değişince aynı ortamın başka bir hesapta yeniden kurulabilmesi).

AWS'nin ücretsiz kullanım modeli 15 Temmuz 2025'te değişti: bu tarihten sonra açılan
hesaplar klasik "12 ay EC2/RDS 750 saat ücretsiz" kotasını almıyor, sadece 6 ay geçerli
$100(+$100) kredi havuzu alıyor ve kredi/süre dolunca hesap kapanıyor (Paid'e geçilmezse).
Kullanıcının elindeki hesapta **$45 kalmış** — bu, mimariyi "7/24 çalışan tam kopya" değil,
"gerektiğinde ayağa kaldırılıp indirilen, ucuz ve tamamen Terraform ile tanımlı" bir ortam
olarak tasarlamayı gerektiriyor.

## What Changes

1. **Güvenli AWS erişimi** — root hesapla çalışılmaz; IAM kullanıcısı + AWS Budgets alarmı
   ilk adım, credential hiçbir zaman sohbete/koda girmez.
2. **Terraform ile tek-parça IaC** — VPC, security group, EC2, Elastic IP, aynı
   `docker-compose.yml` stack'i — Hetzner'deki ile aynı uygulama, farklı altyapı.
3. **Kalıcı, bağımsız S3 bucket** — hem bu ortamdan hem de Hetzner'in offsite backup'ından
   (`[[hetzner-sertlestirme]]`) kullanılacak, ama bu ortamın Terraform yaşam döngüsüne
   **bağlı değil** (ortam `destroy` edilse bile bucket kalır).
4. **Maliyet disiplini** — AWS Budgets email alarmı, "kullanınca aç, işin bitince
   `terraform destroy`" akışı, $45'i aylara yayacak instance/kullanım tercihleri.
5. **Taşınabilirlik** — hesaba özel hiçbir değer hardcode edilmez; aynı kod yeni bir
   free-tier hesaba `terraform apply` ile yeniden kurulabilir.

## Capabilities

### New Capabilities
- `aws-iam-bootstrap`: Root dışı, Terraform için scoped IAM kullanıcı + erişim anahtarı
  yönetimi (kullanıcının kendi terminalinde, sohbete girmeden)
- `aws-budget-guardrail`: AWS Budgets ile eşikli email alarmı ($10/$25/$40)
- `terraform-aws-stack`: VPC + SG + EC2 + EIP, tek `terraform apply`/`destroy` ile
  kurulup sökülebilir
- `s3-durable-bucket`: Deneysel stack'ten bağımsız, kalıcı S3 backup/artifact bucket'ı
- `portable-iac`: Hesap/bölge değişse de aynı kodun yeniden çalışabilmesi (değişken
  bazlı, hardcoded ID yok)

## Impact

- **Yeni dizin**: `infra/aws/` — Terraform kökü (`providers.tf`, `variables.tf`,
  `main.tf`, `outputs.tf`), local state (`.gitignore`'a `*.tfstate*`, `.terraform/`)
- **Yeni dizin**: `infra/aws/bootstrap/` — IAM kullanıcı + S3 bucket için ayrı, minik ve
  nadiren değişen bir Terraform kökü (blast radius ayrımı — ana stack `destroy` edilirken
  bunlar etkilenmez)
- **Repo dışı**: kullanıcının kendi `~/.aws/credentials` dosyası (asla repoya girmez)
- **Maliyet**: tahmini ~$15-30/ay (instance açıkken); disiplinli kapatma ile $45'in
  aylara yayılması hedefleniyor — kesin sayı Faz 0'daki hesap/bölge teyidine bağlı
