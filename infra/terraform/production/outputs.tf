output "region" {
  description = "AWS region containing the production infrastructure."
  value       = var.aws_region
}

output "vpc_id" {
  description = "ID of the dedicated PersonalHub VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "ID of the initial public subnet."
  value       = aws_subnet.public.id
}

output "security_group_id" {
  description = "ID of the zero-ingress EC2 security group."
  value       = aws_security_group.host.id
}

output "ec2_instance_id" {
  description = "ID of the PersonalHub EC2 instance for SSM targeting."
  value       = aws_instance.personalhub.id
}

output "ec2_public_ip" {
  description = "Public IPv4 used only for instance-initiated outbound connectivity."
  value       = aws_instance.personalhub.public_ip
}

output "ecr_repository_url" {
  description = "URL of the private PersonalHub ECR repository."
  value       = aws_ecr_repository.personalhub.repository_url
}

output "postgres_backup_bucket_name" {
  description = "Name of the private bucket reserved for PostgreSQL backups."
  value       = aws_s3_bucket.postgres_backups.id
}

output "ssm_instance_role_name" {
  description = "IAM role attached to the EC2 instance."
  value       = aws_iam_role.host.name
}

output "ansible_transfer_bucket_name" {
  description = "Private, non-versioned S3 bucket for ephemeral Ansible-over-SSM module transfers."
  value       = aws_s3_bucket.ansible_transfer.id
}

output "ansible_controller_policy_arn" {
  description = "Least-privilege policy available for attachment to a future Ansible controller identity."
  value       = aws_iam_policy.ansible_controller_transfer.arn
}
