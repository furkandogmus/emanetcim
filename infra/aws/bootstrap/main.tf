# Bu kök NADİREN değişir ve stack/ kökünün `terraform destroy`'undan bağımsız yaşar.
# S3 bucket adları global-unique olduğundan random_id ile taşınabilirlik sağlanır —
# aynı kod başka bir AWS hesabında farklı bir bucket adıyla sorunsuz apply edilebilir.

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "backups" {
  bucket = "bagajpark-backups-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {} # bucket'taki tüm objelere uygula

    # Güncel (current) obje versiyonları için hiçbir expiration kuralı YOK —
    # sadece pg_dump'ların ÜZERİNE yazılan/güncellenen eski versiyonlar süre sonunda silinir.
    noncurrent_version_expiration {
      noncurrent_days = var.backup_bucket_lifecycle_days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --- TLS materyali: SSM Parameter Store (SecureString, KMS ile şifreli) ---
# sensitive() ile sarılıyor ki `terraform plan/apply` çıktısında hiçbir zaman açık
# değer görünmesin (sadece "(sensitive value)").

resource "aws_ssm_parameter" "tls_cert" {
  name        = "${var.ssm_parameter_prefix}/cert"
  description = "Cloudflare Origin Certificate (aws-test.bagajpark.com)"
  type        = "SecureString"
  value       = sensitive(file(pathexpand(var.tls_cert_path)))
}

resource "aws_ssm_parameter" "tls_key" {
  name        = "${var.ssm_parameter_prefix}/key"
  description = "Cloudflare Origin Certificate private key (aws-test.bagajpark.com)"
  type        = "SecureString"
  value       = sensitive(file(pathexpand(var.tls_key_path)))
}

# --- CI/CD: GitHub Actions OIDC → SSM Run Command, statik AWS key hic kullanilmiyor ---
# Bu hesapta GitHub OIDC provider zaten mevcuttu (2026-07-15, bu degisiklikten once,
# baska bir amacla kurulmus). "resource" ile yeniden yaratmaya calismak yerine "data" ile
# sadece referans aliniyor — [[managed-service-ownership]]: biz olusturmadigimiz bir
# kaynagi Terraform state'imize alip yanlislikla destroy riskine sokmuyoruz.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "github_deploy" {
  name = "bagajpark-aws-test-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/${var.github_deploy_branch}"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy_permissions" {
  name = "ssm-deploy-and-config-upload"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SendCommandToTaggedInstances"
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/*"
        Condition = {
          StringEquals = { "ssm:resourceTag/Project" = "bagajpark-aws-test" }
        }
      },
      {
        Sid      = "SendCommandDocument"
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = "arn:aws:ssm:${var.region}::document/AWS-RunShellScript"
      },
      {
        Sid      = "ReadCommandStatus"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ssm:ListCommands"]
        Resource = "*"
      },
      {
        Sid      = "UploadDeployConfig"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.backups.arn}/${var.deploy_config_prefix}/*"
      }
    ]
  })
}
