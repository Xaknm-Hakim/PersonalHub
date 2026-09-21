locals {
  ansible_transfer_bucket_name = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}-ansible-ssm-xfer"
}

resource "aws_s3_bucket" "ansible_transfer" {
  bucket        = local.ansible_transfer_bucket_name
  force_destroy = false

  tags = {
    Name    = local.ansible_transfer_bucket_name
    Purpose = "ansible-ssm-transfer"
  }
}

resource "aws_s3_bucket_ownership_controls" "ansible_transfer" {
  bucket = aws_s3_bucket.ansible_transfer.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "ansible_transfer" {
  bucket = aws_s3_bucket.ansible_transfer.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ansible_transfer" {
  bucket = aws_s3_bucket.ansible_transfer.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "ansible_transfer" {
  bucket = aws_s3_bucket.ansible_transfer.id

  rule {
    id     = "expire-abandoned-ansible-transfers"
    status = "Enabled"

    filter {}

    expiration {
      days = 1
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

data "aws_iam_policy_document" "ansible_transfer_tls" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.ansible_transfer.arn,
      "${aws_s3_bucket.ansible_transfer.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "ansible_transfer" {
  bucket = aws_s3_bucket.ansible_transfer.id
  policy = data.aws_iam_policy_document.ansible_transfer_tls.json
}

data "aws_iam_policy_document" "ansible_controller_transfer" {
  statement {
    sid    = "InspectAnsibleTransferBucket"
    effect = "Allow"
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]
    resources = [aws_s3_bucket.ansible_transfer.arn]
  }

  statement {
    sid    = "TransferAnsiblePayloads"
    effect = "Allow"
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.ansible_transfer.arn}/*"]
  }
}

resource "aws_iam_policy" "ansible_controller_transfer" {
  name        = "${local.name_prefix}-ansible-ssm-transfer"
  description = "Least-privilege S3 transfer access for an Ansible controller using AWS SSM"
  policy      = data.aws_iam_policy_document.ansible_controller_transfer.json

  tags = {
    Purpose = "ansible-ssm-controller"
  }
}
