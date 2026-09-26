locals {
  github_repository = "Xaknm-Hakim/PersonalHub"
  github_main_ref   = "repo:${local.github_repository}:ref:refs/heads/main"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  # DigiCert Global Root G2, currently used by GitHub's Actions OIDC endpoint.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
  ]

  tags = {
    Name = "github-actions"
  }
}

data "aws_iam_policy_document" "github_build_assume_role" {
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

resource "aws_iam_role" "github_build" {
  name                 = "${local.name_prefix}-github-build"
  assume_role_policy   = data.aws_iam_policy_document.github_build_assume_role.json
  max_session_duration = 3600

  tags = {
    Name = "${local.name_prefix}-github-build"
  }
}

data "aws_iam_policy_document" "github_build" {
  statement {
    sid       = "EcrAuthorization"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "PublishAndVerifyPersonalHubImages"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeImageScanFindings",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.personalhub.arn]
  }
}

resource "aws_iam_role_policy" "github_build" {
  name   = "${local.name_prefix}-github-build-ecr-publish"
  role   = aws_iam_role.github_build.id
  policy = data.aws_iam_policy_document.github_build.json
}
