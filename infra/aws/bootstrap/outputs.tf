output "backup_bucket_name" {
  description = "Hetzner offsite backup hedefi olarak da kullanılacak (bkz. [[hetzner-sertlestirme]])"
  value       = aws_s3_bucket.backups.bucket
}

output "backup_bucket_arn" {
  value = aws_s3_bucket.backups.arn
}

output "tls_cert_parameter_name" {
  description = "stack/ kökü bu adı (aynı ssm_parameter_prefix ile) okur — değer değil, sadece isim/ARN"
  value       = aws_ssm_parameter.tls_cert.name
}

output "tls_key_parameter_arn" {
  value = aws_ssm_parameter.tls_key.arn
}

output "github_deploy_role_arn" {
  description = "GitHub Actions secrets → AWS_DEPLOY_ROLE_ARN olarak eklenecek"
  value       = aws_iam_role.github_deploy.arn
}

output "deploy_config_s3_prefix" {
  value = "s3://${aws_s3_bucket.backups.bucket}/${var.deploy_config_prefix}/"
}
