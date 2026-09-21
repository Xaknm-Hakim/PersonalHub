output "state_bucket_name" {
  description = "S3 bucket used by the production Terraform backend."
  value       = aws_s3_bucket.terraform_state.id
}

output "state_bucket_arn" {
  description = "ARN of the Terraform state bucket."
  value       = aws_s3_bucket.terraform_state.arn
}

output "state_bucket_region" {
  description = "AWS region of the Terraform state bucket."
  value       = var.aws_region
}

output "production_backend_key" {
  description = "Recommended object key for production Terraform state."
  value       = "production/terraform.tfstate"
}
