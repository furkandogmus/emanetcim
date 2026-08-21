# Maliyet alarmı — projenin "AWS'e ekstra büyük maliyet çıkarma" kısıtının teknik karşılığı.
#
# DURUM: Bu alarm 2026-08-21 itibarıyla AWS'te ZATEN VAR, ama ELLE kurulmuştu, yani
# Terraform state'inde değildi. Kodlaştırılmasının sebebi maliyet değil TAŞINABİLİRLİK:
# free-tier kredisi bitip başka bir hesaba geçildiğinde elle kurulmuş bir alarm gelmez ve
# yeni hesap sessizce korumasız kalır — tam da IaC'ye geçme gerekçesinin karşılığı.
#
# Bu yüzden burada YENİ bir bütçe yaratılmıyor; var olanın adı kullanılıyor ve
# `terraform import` ile devralınıyor (bkz. README "Maliyet"). Aynı hesapta apply
# etmeden önce import ŞART — aksi halde ikinci bir bütçe oluşur ve her eşikte çift
# e-posta gelir.
#
# Neden bootstrap/ içinde: bir bütçe alarmı izlediği altyapıdan uzun ömürlü olmalı.
# `stack/` (EC2, EIP, VPC) test için sökülüp yeniden kurulabiliyor; alarm onunla silinirse
# tam da harcamanın kontrolsüz kaldığı dönemde kör kalırız.
#
# Maliyeti yok: AWS Budgets'ta ilk iki bütçe ve e-posta bildirimleri ücretsiz.
#
# `budget_alert_email` boşsa hiçbir kaynak yaratılmaz — bkz. variables.tf.

locals {
  budget_enabled = var.budget_alert_email != "" ? 1 : 0
}

resource "aws_budgets_budget" "monthly_cost" {
  count = local.budget_enabled

  name         = var.budget_name
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Eşikler hesapta hâlihazırda kurulu olanla birebir aynı tutuldu (%25/50/80/100
  # GERÇEKLEŞEN) — import'un "no changes" ile oturması için. Tek EKLENEN, aşağıdaki
  # FORECASTED bildirimi.
  dynamic "notification" {
    for_each = [25, 50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }

  # %100 TAHMİNİ: ayın sonunda eşiğin aşılacağı ÖNGÖRÜLÜYOR. Gerçekleşen uyarılardan
  # önce geldiği için, harcamayı ay bitmeden kesmeye yarayan tek sinyal budur —
  # %100 GERÇEKLEŞEN geldiğinde para çoktan harcanmış olur.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
