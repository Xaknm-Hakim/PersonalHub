variable "aws_region" {
  description = "AWS region for all PersonalHub production resources."
  type        = string
  default     = "ap-southeast-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]+$", var.aws_region))
    error_message = "aws_region must be a valid AWS region name."
  }
}

variable "project_name" {
  description = "Lowercase project identifier used in resource names and tags."
  type        = string
  default     = "personalhub"

  validation {
    condition     = length(var.project_name) <= 15 && can(regex("^[a-z0-9]$|^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "project_name must be at most 15 lowercase alphanumeric or hyphen characters and cannot start or end with a hyphen."
  }
}

variable "environment" {
  description = "Lowercase environment identifier used in resource names and tags."
  type        = string
  default     = "production"

  validation {
    condition     = length(var.environment) <= 15 && can(regex("^[a-z0-9]$|^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.environment))
    error_message = "environment must be at most 15 lowercase alphanumeric or hyphen characters and cannot start or end with a hyphen."
  }
}

variable "instance_type" {
  description = "ARM64 EC2 instance type for the PersonalHub host."
  type        = string
  default     = "t4g.small"

  validation {
    condition     = can(regex("^(t4g|a1|c[6-9]g|m[6-9]g|r[6-9]g)\\.", var.instance_type))
    error_message = "instance_type must be an ARM64-capable AWS instance family."
  }
}

variable "ec2_ami_id" {
  description = "Explicit Canonical Ubuntu 24.04 ARM64 AMI for the production host; changing it is a reviewed replacement event."
  type        = string
  default     = "ami-0f78fc0711eeb6f28"

  validation {
    condition     = can(regex("^ami-[0-9a-f]{8,17}$", var.ec2_ami_id))
    error_message = "ec2_ami_id must be a valid AMI ID."
  }
}

variable "vpc_cidr" {
  description = "IPv4 CIDR for the dedicated PersonalHub VPC."
  type        = string
  default     = "10.42.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid IPv4 CIDR."
  }
}

variable "public_subnet_cidr" {
  description = "IPv4 CIDR for the initial public subnet."
  type        = string
  default     = "10.42.1.0/24"

  validation {
    condition     = can(cidrnetmask(var.public_subnet_cidr))
    error_message = "public_subnet_cidr must be a valid IPv4 CIDR."
  }
}

variable "root_volume_size_gib" {
  description = "Encrypted gp3 root volume size in GiB."
  type        = number
  default     = 25

  validation {
    condition     = var.root_volume_size_gib >= 20 && var.root_volume_size_gib <= 100
    error_message = "root_volume_size_gib must be between 20 and 100 GiB."
  }
}

variable "backup_retention_days" {
  description = "Days to retain current PostgreSQL backup objects."
  type        = number
  default     = 90

  validation {
    condition     = var.backup_retention_days >= 30 && var.backup_retention_days <= 3650
    error_message = "backup_retention_days must be between 30 and 3650 days."
  }
}

variable "ecr_image_retention_count" {
  description = "Maximum number of ECR images retained for deployment and rollback."
  type        = number
  default     = 30

  validation {
    condition     = var.ecr_image_retention_count >= 10 && var.ecr_image_retention_count <= 200
    error_message = "ecr_image_retention_count must be between 10 and 200."
  }
}

variable "production_postgres_password" {
  description = "Write-only PostgreSQL password used to create or rotate the production SecureString parameter."
  type        = string
  sensitive   = true
  ephemeral   = true

  validation {
    condition     = length(var.production_postgres_password) >= 43 && can(regex("^[A-Za-z0-9_-]+$", var.production_postgres_password))
    error_message = "production_postgres_password must be at least 43 URL-safe characters."
  }
}

variable "production_postgres_password_version" {
  description = "Increment to intentionally rotate the write-only PostgreSQL password."
  type        = number
  default     = 2

  validation {
    condition     = var.production_postgres_password_version >= 1 && floor(var.production_postgres_password_version) == var.production_postgres_password_version
    error_message = "production_postgres_password_version must be a positive integer."
  }
}

variable "production_cloudflare_tunnel_token" {
  description = "Write-only Cloudflare Tunnel token used to create or rotate the production SecureString parameter."
  type        = string
  sensitive   = true
  ephemeral   = true

  validation {
    condition     = length(var.production_cloudflare_tunnel_token) >= 20
    error_message = "production_cloudflare_tunnel_token must not be empty or truncated."
  }
}

variable "production_cloudflare_tunnel_token_version" {
  description = "Increment to intentionally rotate the write-only Cloudflare Tunnel token."
  type        = number
  default     = 2

  validation {
    condition     = var.production_cloudflare_tunnel_token_version >= 1 && floor(var.production_cloudflare_tunnel_token_version) == var.production_cloudflare_tunnel_token_version
    error_message = "production_cloudflare_tunnel_token_version must be a positive integer."
  }
}
