locals {
  production_parameter_names = {
    postgres_password       = "/${var.project_name}/${var.environment}/postgres/password"
    cloudflare_tunnel_token = "/${var.project_name}/${var.environment}/cloudflare/tunnel-token"
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
