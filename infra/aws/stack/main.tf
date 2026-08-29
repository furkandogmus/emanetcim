data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# --- EC2 IAM role: SSM'den TLS materyalini kendi rolüyle çeker, statik AWS key
# sunucuya asla konmaz. bootstrap/ kökündeki SSM parametrelerinin ARN'ı sadece isimlendirme
# sözleşmesiyle (ssm_parameter_prefix) kuruluyor — state coupling yok, kasıtlı
# ([[aws-paralel-ortam]] design.md "blast radius ayrımı").

resource "aws_iam_role" "app" {
  name = "${var.project_name}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "app_ssm_read" {
  name = "read-tls-ssm-parameters"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = [
          "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_parameter_prefix}/cert",
          "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_parameter_prefix}/key",
        ]
      },
      {
        # SecureString varsayilan AWS-managed KMS anahtariyla (alias/aws/ssm) sifreli —
        # decrypt icin bu da gerekli, sadece SSM servisi uzerinden kullanima izin verilir.
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" }
        }
      }
    ]
  })
}

# Uygulama env anahtarlari (docker-compose.env) -- scripts/secrets-render.sh
# her deploy'da bunlardan dosyayi uretir.
#
# NEDEN AYRI POLICY: TLS onegi tek tek iki parametre (cert/key) ile
# sinirliyken bu onek altindaki her sey okunabilir olmali; ikisini tek
# policy'de birlestirmek TLS'in dar kapsamini gereksiz genisletirdi.
resource "aws_iam_role_policy" "app_ssm_read_env" {
  name = "read-app-env-ssm-parameters"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        # GetParametersByPath onek uzerinde, GetParameter tek tek okuma icin.
        Action = ["ssm:GetParametersByPath", "ssm:GetParameter", "ssm:GetParameters"]
        Resource = [
          "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}",
          "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" }
        }
      }
    ]
  })
}

# Tek seferlik seed icin yazma izni -- varsayilan KAPALI.
#
# Sirlar bugun yalnizca sunucunun diskinde, tek kopya. Onlari Parameter
# Store'a tasiyan scripts/secrets-put.sh kutuda calisir (degerler laptop'a
# inmesin diye), dolayisiyla instance rolunun gecici olarak yazabilmesi
# gerekir. Seed bittiginde `enable_secret_seeding = false` ile geri alinir:
# uygulamanin normal isleyisinde kendi sirlarini degistirmesi gerekmez.
resource "aws_iam_role_policy" "app_ssm_write_env" {
  count = var.enable_secret_seeding ? 1 : 0

  name = "seed-app-env-ssm-parameters"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:PutParameter"]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:GenerateDataKey"]
        Resource = "*"
        Condition = {
          StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" }
        }
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project_name}-app-profile"
  role = aws_iam_role.app.name
}

# SSM Agent'in "managed instance" olarak calisip Run Command alabilmesi icin gereken
# AWS-managed policy (ssmmessages/ec2messages/ssm:UpdateInstanceInformation vb. — bunlar
# resource-level desteklemiyor, custom policy yazmaya degmez).
resource "aws_iam_role_policy_attachment" "app_ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# CI'nin yukledigi docker-compose.yml'i cekebilmek icin.
# Yedekler S3'e instance roluyle yazilir (scripts/backup-s3.sh). Hetzner'de
# yedekler yalnizca sunucu diskindeydi; sunucu giderse yedek de giderdi.
# Yalnizca `backups/` onekine PutObject -- deploy-config'e yazamaz, hicbir
# seyi silemez/okuyamaz.
resource "aws_iam_role_policy" "app_backup_write" {
  name = "write-backups"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "arn:aws:s3:::${var.deploy_config_bucket}/backups/*"
    }]
  })
}

resource "aws_iam_role_policy" "app_deploy_config_read" {
  name = "read-deploy-config"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "arn:aws:s3:::${var.deploy_config_bucket}/${var.deploy_config_prefix}/*"
      },
      {
        # `aws s3 sync` (public/ senkronu) onek listelemesi ister; yalnizca bu onek.
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.deploy_config_bucket}"
        Condition = {
          StringLike = { "s3:prefix" = ["${var.deploy_config_prefix}/*"] }
        }
      }
    ]
  })
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Cloudflare edge aralik listeleri -- kaynak Cloudflare'in kendi yayini.
# https://www.cloudflare.com/ips-v4  ve  /ips-v6
data "http" "cloudflare_ipv4" {
  url = "https://www.cloudflare.com/ips-v4"
}

data "http" "cloudflare_ipv6" {
  url = "https://www.cloudflare.com/ips-v6"
}

locals {
  cf_ipv4 = compact(split("\n", trimspace(data.http.cloudflare_ipv4.response_body)))
  cf_ipv6 = compact(split("\n", trimspace(data.http.cloudflare_ipv6.response_body)))

  # Normalde yalnizca Cloudflare; acil durumda herkese acik (bkz. degiskenin aciklamasi).
  web_ipv4 = var.allow_direct_origin_access ? ["0.0.0.0/0"] : local.cf_ipv4
  web_ipv6 = var.allow_direct_origin_access ? ["::/0"] : local.cf_ipv6
}

# 80/443 yalnizca Cloudflare edge'ine acik.
#
# NEDEN: bagajpark.com Cloudflare arkasinda ve nginx bir Cloudflare Origin
# Certificate sunuyor (nginx/conf.d/default.conf) -- yani mimari zaten
# "yalnizca Cloudflare" olarak tasarlanmis. Ama guvenlik grubu 0.0.0.0/0
# oldugu surece origin IP'yi ogrenen biri Cloudflare'i tamamen atlayip
# dogrudan baglanabiliyordu: WAF yok, rate limit yok, DDoS korumasi yok.
# Origin IP'yi repodan silmek bunu kapatmaz, yalnizca adresi zorlastirir.
#
# ACME bagimliligi YOK: sertifika Cloudflare Origin CA'dan geliyor, certbot
# ve HTTP-01 dogrulamasi kullanilmiyor. Yani 80'i daraltmak sertifika
# yenilemeyi kirmaz.
resource "aws_security_group" "web" {
  name = "${var.project_name}-web"
  # DIKKAT: AWS guvenlik grubu aciklamasini DEGISTIRILEMEZ kabul eder; bu metni
  # duzeltmek gruba replace zorlar ve replace instance'a da dokunur. Metin bu
  # yuzden eski haliyle birakildi -- guncel gercek asagidaki Ingress etiketinde
  # ve bu bloktaki yorumlarda. (2026-08-29: plan "2 to destroy" gosteriyordu,
  # sebebi buydu.)
  description = "80/443 herkese acik, SSH sadece allowed_ssh_cidr degerine acik"
  vpc_id      = aws_vpc.main.id

  ingress {
    description      = "HTTP (Cloudflare edge)"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = local.web_ipv4
    ipv6_cidr_blocks = local.web_ipv6
  }

  ingress {
    description      = "HTTPS (Cloudflare edge)"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = local.web_ipv4
    ipv6_cidr_blocks = local.web_ipv6
  }

  ingress {
    description = "SSH (custom port, kisitli CIDR)"
    from_port   = var.ssh_port
    to_port     = var.ssh_port
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-web-sg"
    # description degistirilemedigi icin guncel durum burada duruyor.
    Ingress = var.allow_direct_origin_access ? "ACIL-DURUM-herkese-acik" : "yalnizca-cloudflare-edge"
  }

  lifecycle {
    # Cloudflare listesi bos ya da anlamsiz kisa donerse (fetch bozuldu, sayfa
    # degisti) bu kaynak SIFIR ingress ile apply edilir ve siteyi kapatir.
    # Onu apply'a birakmak yerine planda durduruyoruz.
    precondition {
      condition = var.allow_direct_origin_access || (
        length(local.cf_ipv4) >= 10 && length(local.cf_ipv6) >= 5
      )
      error_message = "Cloudflare aralik listesi beklenenden kisa geldi (ipv4=${length(local.cf_ipv4)}, ipv6=${length(local.cf_ipv6)}; beklenen >=10 ve >=5). Liste bozuk olabilir -- apply edilirse 80/443 tamamen kapanir. https://www.cloudflare.com/ips-v4 adresini kontrol edin."
    }
  }
}

resource "aws_key_pair" "deployer" {
  key_name   = "${var.project_name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = aws_key_pair.deployer.key_name
  iam_instance_profile   = aws_iam_instance_profile.app.name

  root_block_device {
    volume_size = var.root_volume_gb
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/cloud-init.sh.tftpl", {
    ssh_port      = var.ssh_port
    region        = var.region
    ssm_cert_name = "${var.ssm_parameter_prefix}/cert"
    ssm_key_name  = "${var.ssm_parameter_prefix}/key"
  })

  tags = { Name = "${var.project_name}-app" }

  # cloud-init yalnizca ILK acilista calisir; sablon sonradan degisince
  # Terraform user_data'yi guncellemek icin instance'i DURDURUP ACAR (canli
  # kesinti). Calisan bir prod instance'ta bunun hicbir faydasi yok: yeni
  # sablon ancak yeni instance'ta anlam tasir. (2026-08-22: plan "1 to change"
  # gosteriyordu, sebebi buydu.)
  lifecycle {
    # `ami` de ayni sebeple yok sayiliyor: data.aws_ami.al2023 `most_recent`
    # oldugu icin Amazon her yeni AL2023 yayininda id degisiyor ve plan CALISAN
    # PROD INSTANCE'INI yeniden kurmak istiyor -- ilgisiz bir degisiklik icin
    # apply eden kisi bunu farketmezse kesinti yasanir. (2026-08-29: bu
    # guvenlik grubu degisikliginin plani "2 to destroy" gosterdi, biri buydu.)
    # AMI yukseltmesi ARTIK BILINCLI bir is: ignore_changes'ten `ami` gecici
    # olarak cikarilir, plan okunur, bakim penceresinde apply edilir.
    ignore_changes = [user_data, ami]
  }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = { Name = "${var.project_name}-eip" }
}
