# Hesaba/bölgeye özel hiçbir değer burada hardcode edilmez — [[aws-paralel-ortam]]
# design.md "Taşınabilirlik" kararı. AMI, `data "aws_ami"` ile bölgeden bağımsız sorgulanır.

variable "region" {
  description = "AWS bölgesi"
  type        = string
  default     = "eu-central-1"
}

variable "aws_profile" {
  # DIKKAT — profil ve workspace BIRLIKTE degisir:
  #   workspace `hesap2`  -> profil `bagajpark-yeni` (hesap 772853132412) = CANLI
  #   workspace `default` -> profil `bagajpark`      (hesap 269174115166) = eski, kapatiliyor
  # Varsayilan 2026-08-29'da `bagajpark`'tan `bagajpark-yeni`ye alindi: yerel workspace
  # zaten `hesap2` (yani CANLI hesabin state'i) ama profil hala eski hesaba bakiyordu.
  # Bu ikisi ayristiginda `terraform plan` her kaynagi "to create" gosterir ve bir apply
  # altyapiyi YANLIS hesapta ikinci kez kurar. Kesim kaydi: infra/aws/CUTOVER.md.
  # Dogrulama (salt okunur):
  #   terraform workspace show
  #   aws sts get-caller-identity --profile bagajpark-yeni --query Account --output text
  description = "~/.aws/config içindeki profil adı. Workspace ile eşleşmeli (yukarıdaki nota bakın)."
  type        = string
  default     = "bagajpark-yeni"
}

variable "instance_type" {
  description = "docker-compose.yml stack'i (~2.3GB bellek limiti) icin 4GB gerekli. Bu hesap 'Free Plan' oldugundan EC2 API sadece free-tier-eligible tipleri kabul ediyor (aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true ile dogrulandi, 2026-08-21) — t3.medium reddedildi, c7i-flex.large (4GB, x86_64) izinli listede."
  type        = string
  default     = "c7i-flex.large"
}

variable "root_volume_gb" {
  description = "AL2023 AMI snapshot'i >=30GB gerektiriyor (denenmis: 20GB InvalidBlockDeviceMapping hatasi verdi)"
  type        = number
  default     = 30
}

variable "ssh_port" {
  description = "22 KULLANILMAZ — Hetzner sunucusunda 22'ye hiç istek gelmiyordu ama 12022'ye 74 günde 334k başarısız deneme geldi; yine de varsayılan portu değiştirmek gürültüyü düşürür"
  type        = number
  default     = 2222
}

variable "allowed_ssh_cidr" {
  description = "SSH'a izinli CIDR — 0.0.0.0/0 KULLANMA, kendi IP'ni '<ip>/32' olarak ver (curl ifconfig.me ile öğrenebilirsin). Kasıtlı olarak varsayılanı yok, sen doldurmalısın."
  type        = string
}

variable "ssh_public_key_path" {
  description = "AWS'ye yüklenecek public key (private key hiçbir zaman Terraform'a girmez)"
  type        = string
  default     = "~/.ssh/aws-bagajpark.pub"
}

variable "project_name" {
  # Isim tarihseldir ve ARTIK YANILTICIDIR: bu stack 2026-08-23 kesiminden beri
  # CANLI ortamdir, "aws-test" degil. ISIM YINE DE DEGISTIRILMEMELI:
  #   - `.github/workflows/ci.yml` deploy job'i hedefi `tag:Project=bagajpark-aws-test`
  #     ile secer; ad degisirse deploy hedefini bulamaz.
  #   - IAM rol / instance profile adlari bu onekten turuyor; degistirmek EC2 dahil
  #     kaynaklarin yeniden olusturulmasi demektir (canli kesinti).
  description = "Kaynak ad öneki. Tarihsel ad — CI deploy hedefi bu etikete bağlı, değiştirmeyin."
  type        = string
  default     = "bagajpark-aws-test"
}

variable "ssm_parameter_prefix" {
  description = "bootstrap/ kökündeki ssm_parameter_prefix ile AYNI olmalı (state paylaşımı yok, sadece isimlendirme sözleşmesi ile bağlanıyorlar)"
  type        = string
  default     = "/bagajpark/aws-test/tls"
}

variable "allow_direct_origin_access" {
  description = "ACIL DURUM ANAHTARI. true yapilirsa 80/443 tekrar 0.0.0.0/0'a acilir ve Cloudflare atlanabilir hale gelir -- WAF, rate limit ve DDoS korumasi devre disi kalir. Yalnizca Cloudflare kaynakli bir kesintiyi teshis ederken acin, bitince false'a alip tekrar apply edin. SSH bu anahtardan etkilenmez (ayri port, kisitli CIDR), yani sunucuya erisim her halukarda durur."
  type        = bool
  default     = false
}

variable "ssm_app_parameter_prefix" {
  description = "Uygulama env anahtarlarinin SSM onegi. TLS onegiyle (ssm_parameter_prefix) BILEREK ayri: TLS'i yalnizca nginx okur, bu oneki uygulama okur ve seed sirasinda yazilabilir hale gelir."
  type        = string
  default     = "/bagajpark/env/app"
}

variable "enable_secret_seeding" {
  description = "Instance rolune bu onek altina ssm:PutParameter verir. YALNIZCA tek seferlik seed (scripts/secrets-put.sh) icin true yapin, seed bitince false'a alip tekrar apply edin. Surekli acik birakmak, kutuyu ele geciren birine kendi sirlarini kalici olarak degistirme imkani verir."
  type        = bool
  default     = false
}

variable "deploy_config_bucket" {
  # 2026-08-29: varsayilan eski hesabin (269174115166) bucket'i olan
  # `bagajpark-backups-43403243`ti; canli hesabin bucket'i `bagajpark-backups-1d9eb152`
  # (infra/aws/CUTOVER.md "Son durum"). Stale varsayilan, IAM policy'sini BASKA BIR
  # HESABIN bucket'ina baglar -- CI'nin sunucuya biraktigi deploy config okunamaz.
  # Dogrulama: cd infra/aws/bootstrap && terraform output backup_bucket_name
  description = "bootstrap/ çıktısındaki backup_bucket_name — bucket adı random_id içerdiğinden isimlendirme sözleşmesiyle DEĞİL, bu değişkenle bağlanıyor. Hesap değişirse `terraform output backup_bucket_name` ile güncellenmeli."
  type        = string
  default     = "bagajpark-backups-1d9eb152"
}

variable "deploy_config_prefix" {
  type    = string
  default = "deploy-config"
}
