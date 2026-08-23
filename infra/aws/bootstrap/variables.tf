# Hesaba/bölgeye özel hiçbir değer burada hardcode edilmez — [[aws-paralel-ortam]]
# design.md "Taşınabilirlik" kararı. Yeni bir hesaba taşınırken sadece bu değerler
# (ya da varsayılanları) gözden geçirilir.

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

variable "backup_bucket_lifecycle_days" {
  description = "Eski (noncurrent) obje versiyonlarının kaç gün sonra silineceği. Güncel/aktif yedekler ASLA otomatik silinmez."
  type        = number
  default     = 90
}

# --- TLS materyali (Cloudflare Origin Certificate) ---
# Yerel diskte loose dosya olarak durmasın diye SSM Parameter Store'a (SecureString,
# KMS ile şifreli) taşınıyor. stack/ kökü bunu kendi IAM roluyle çekiyor (bkz.
# stack/main.tf aws_iam_role_policy + cloud-init.sh.tftpl) — manuel scp bir daha
# gerekmiyor. Değerler `sensitive = true` olduğundan `terraform plan`/`apply` çıktısında
# hiçbir zaman açık yazılmaz.

variable "tls_cert_path" {
  description = "Cloudflare Origin Certificate (.crt) yerel dosya yolu"
  type        = string
  default     = "~/Documents/personal/tls/aws-test.crt"
}

variable "tls_key_path" {
  description = "Cloudflare Origin Certificate private key (.key) yerel dosya yolu"
  type        = string
  default     = "~/Documents/personal/tls/aws-test.key"
  sensitive   = true
}

variable "ssm_parameter_prefix" {
  description = "SSM parametre adı öneki — stack/ kökü aynı önekle okur"
  type        = string
  default     = "/bagajpark/aws-test/tls"
}

# --- CI/CD: GitHub Actions OIDC ---

variable "github_repo" {
  description = "owner/repo formatında — deploy role'ünün assume edilebileceği tek repo"
  type        = string
  default     = "furkandogmus/emanetcim"
}

variable "github_deploy_branch" {
  description = "Bu branch'e push eden workflow'lar deploy role'ünü assume edebilir"
  type        = string
  default     = "main"
}

variable "deploy_config_prefix" {
  description = "backups bucket'ı içinde CI'nin docker-compose.yml vb. yükleyeceği prefix (ayrı bucket açmaya değmez)"
  type        = string
  default     = "deploy-config"
}

# --- Maliyet koruması ---
# Projenin en sert kısıtı "AWS'e ekstra büyük maliyet çıkarmamak". Bunun tek gerçek
# güvencesi, kredi bitmeden HABER ALMAK. AWS Budgets'ta ilk 2 bütçe ücretsiz.
# E-posta bilinçli olarak varsayılansız: boş bırakılırsa bütçe kaynağı hiç
# oluşturulmaz (count = 0), yani kimsenin adresi koda gömülmüş olmaz ve başka bir
# free-tier hesaba taşırken yeniden düşünülmesi gerekir.

variable "budget_alert_email" {
  description = "Bütçe uyarılarının gideceği e-posta. BOŞ BIRAKILIRSA bütçe alarmı oluşturulmaz."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Aylık tahmini/gerçekleşen harcama eşiği (USD). Eşiklerin yüzdeleri budget.tf içinde."
  type        = number
  default     = 25
}

variable "budget_name" {
  description = "Aylık bütçe alarmının adı (eski hesaptaki mevcut ad: bagajpark-aws-test-guardrail)."
  type        = string
  default     = "bagajpark-aws-test-guardrail"
}
