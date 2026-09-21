variable "aws_region" {
  description = "AWS region that stores the Terraform state bucket."
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
