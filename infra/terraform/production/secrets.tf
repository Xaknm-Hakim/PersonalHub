resource "aws_ssm_parameter" "postgres_password" {
  name             = "/${var.project_name}/${var.environment}/postgres/password"
  description      = "PersonalHub production PostgreSQL password."
  type             = "SecureString"
  value_wo         = var.production_postgres_password
  value_wo_version = var.production_postgres_password_version

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ssm_parameter" "cloudflare_tunnel_token" {
  name             = "/${var.project_name}/${var.environment}/cloudflare/tunnel-token"
  description      = "PersonalHub production Cloudflare Tunnel token."
  type             = "SecureString"
  value_wo         = var.production_cloudflare_tunnel_token
  value_wo_version = var.production_cloudflare_tunnel_token_version

  lifecycle {
    prevent_destroy = true
  }
}
