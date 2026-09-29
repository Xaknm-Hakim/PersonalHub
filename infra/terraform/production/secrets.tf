locals {
  production_parameter_names = {
    postgres_password       = "/${var.project_name}/${var.environment}/postgres/password"
    cloudflare_tunnel_token = "/${var.project_name}/${var.environment}/cloudflare/tunnel-token"
    google_client_id        = "/${var.project_name}/${var.environment}/google/client-id"
    google_client_secret    = "/${var.project_name}/${var.environment}/google/client-secret"
    integration_key         = "/${var.project_name}/${var.environment}/integration/encryption-key"
  }

  production_parameter_arns = {
    for key, name in local.production_parameter_names :
    key => "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${name}"
  }
}

resource "aws_ssm_parameter" "postgres_password" {
  name             = local.production_parameter_names.postgres_password
  description      = "PersonalHub production PostgreSQL password."
  type             = "SecureString"
  value_wo         = var.production_postgres_password
  value_wo_version = var.production_postgres_password_version

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ssm_parameter" "cloudflare_tunnel_token" {
  name             = local.production_parameter_names.cloudflare_tunnel_token
  description      = "PersonalHub production Cloudflare Tunnel token."
  type             = "SecureString"
  value_wo         = var.production_cloudflare_tunnel_token
  value_wo_version = var.production_cloudflare_tunnel_token_version

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ssm_parameter" "google_client_id" {
  name             = local.production_parameter_names.google_client_id
  description      = "PersonalHub production Google OAuth web client ID."
  type             = "SecureString"
  value_wo         = var.production_google_client_id
  value_wo_version = var.production_google_client_id_version

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ssm_parameter" "google_client_secret" {
  name             = local.production_parameter_names.google_client_secret
  description      = "PersonalHub production Google OAuth web client secret."
  type             = "SecureString"
  value_wo         = var.production_google_client_secret
  value_wo_version = var.production_google_client_secret_version

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ssm_parameter" "integration_encryption_key" {
  name             = local.production_parameter_names.integration_key
  description      = "PersonalHub production application-layer integration encryption key."
  type             = "SecureString"
  value_wo         = var.production_integration_encryption_key
  value_wo_version = var.production_integration_encryption_key_version

  lifecycle {
    prevent_destroy = true
  }
}
