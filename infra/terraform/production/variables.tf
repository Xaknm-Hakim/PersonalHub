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
