# Hesaba/bölgeye özel hiçbir değer burada hardcode edilmez — [[aws-paralel-ortam]]
# design.md "Taşınabilirlik" kararı. AMI, `data "aws_ami"` ile bölgeden bağımsız sorgulanır.

variable "region" {
  description = "AWS bölgesi"
  type        = string
  default     = "eu-central-1"
}

variable "aws_profile" {
  description = "~/.aws/config içindeki profil adı (terraform-bagajpark IAM kullanıcısı)"
  type        = string
  default     = "bagajpark"
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
  type    = string
  default = "bagajpark-aws-test"
}

variable "ssm_parameter_prefix" {
  description = "bootstrap/ kökündeki ssm_parameter_prefix ile AYNI olmalı (state paylaşımı yok, sadece isimlendirme sözleşmesi ile bağlanıyorlar)"
  type        = string
  default     = "/bagajpark/aws-test/tls"
}

variable "deploy_config_bucket" {
  description = "bootstrap/ çıktısındaki backup_bucket_name — bucket adı random_id içerdiğinden isimlendirme sözleşmesiyle DEĞİL, bu değişkenle bağlanıyor. Hesap değişirse `terraform output backup_bucket_name` ile güncellenmeli."
  type        = string
  default     = "bagajpark-backups-43403243"
}

variable "deploy_config_prefix" {
  type    = string
  default = "deploy-config"
}
