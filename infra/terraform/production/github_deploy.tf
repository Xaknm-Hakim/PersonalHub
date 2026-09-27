data "aws_iam_policy_document" "github_deploy_assume_role" {
  statement {
    sid     = "GitHubActionsMainBranch"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_main_ref]
    }
  }
}

resource "aws_ssm_document" "personalhub_deploy" {
  name            = "${local.name_prefix}-deploy"
  document_type   = "Command"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Deploy one validated immutable PersonalHub Git SHA through the host-owned helper."
    parameters = {
      DeploySha = {
        type              = "String"
        description       = "Exact lowercase 40-character Git SHA already published to PersonalHub ECR."
        allowedPattern    = "^[0-9a-f]{40}$"
        interpolationType = "ENV_VAR"
      }
    }
    mainSteps = [
      {
        action = "aws:runShellScript"
        name   = "deployPersonalHub"
        inputs = {
          timeoutSeconds = "3600"
          runCommand = [
            "exec sudo -- /usr/local/sbin/personalhub-deploy \"$SSM_DeploySha\"",
          ]
        }
      },
    ]
  })

  tags = {
    Name = "${local.name_prefix}-deploy"
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${local.name_prefix}-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_assume_role.json
  max_session_duration = 3600

  tags = {
    Name = "${local.name_prefix}-github-deploy"
  }
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid     = "SendApprovedDeploymentCommand"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.personalhub.arn,
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:document/${local.name_prefix}-deploy",
    ]
  }

  # SSM command-result APIs do not support resource-level permissions.
  statement {
    sid    = "ReadDeploymentCommandStatus"
    effect = "Allow"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "VerifyPersonalHubCandidate"
    effect = "Allow"
    actions = [
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
      "ecr:DescribeImageScanFindings",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.personalhub.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${local.name_prefix}-github-deploy-access"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json

  depends_on = [aws_ssm_document.personalhub_deploy]
}
