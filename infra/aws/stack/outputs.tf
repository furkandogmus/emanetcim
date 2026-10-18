output "public_ip" {
  value = aws_eip.app.public_ip
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/aws-bagajpark -p ${var.ssh_port} ec2-user@${aws_eip.app.public_ip}"
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ssh_port" {
  value = var.ssh_port
}

output "media_public_base_url" {
  description = "S3_PUBLIC_BASE_URL"
  value       = "https://${aws_s3_bucket.media.bucket}.s3.${aws_s3_bucket.media.region}.amazonaws.com"
}
