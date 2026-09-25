# PersonalHub infrastructure

This directory contains the Terraform state bootstrap, the AWS foundation, the Ansible-over-SSM transport prerequisite, and the production secret parameters used by the host runtime. Terraform does not deploy application containers, initialize PostgreSQL, create the owner, configure Cloudflare, or add a GitHub Actions deployment workflow.

## Architecture

The production stack creates one dedicated VPC (`10.42.0.0/16` by default) with one public subnet, an Internet Gateway, and a public route. One ARM64 `t4g.small` instance runs the explicitly pinned Canonical Ubuntu 24.04 LTS ARM64 AMI selected by `ec2_ami_id`. Terraform validates that exact image against Canonical ownership, Noble naming, ARM64 architecture, EBS root storage, and HVM virtualization. Its encrypted gp3 root disk defaults to 25 GiB.

Publishing a newer Canonical image does not automatically rebuild PersonalHub. An AMI upgrade is a reviewed maintenance event: select and verify a newer Ubuntu 24.04 ARM64 image, update `ec2_ami_id`, confirm current PostgreSQL backups are usable, and review the resulting EC2 replacement plan before deliberately rebuilding the disposable host. Never combine an AMI replacement with an unrelated infrastructure or application change.

The instance receives a public IPv4 because this design deliberately has no NAT Gateway: the address gives the host direct, instance-initiated access to SSM, ECR, package repositories, and later Cloudflare Tunnel endpoints. It does not make a service reachable. The attached security group has no ingress rules—no SSH, HTTP, HTTPS, or PostgreSQL—and only explicit outbound DNS, HTTP, HTTPS, and future Cloudflare Tunnel transport rules.

Administration uses AWS Systems Manager Session Manager and Run Command. The instance role receives AWS-managed `AmazonSSMManagedInstanceCore`; there is no EC2 key pair and SSH is not a fallback. Once the instance is running and its SSM agent has registered, target the `ec2_instance_id` Terraform output with SSM.

Future application images will live in a private, encrypted, scan-on-push ECR repository. Immutable tags and lifecycle cleanup retain up to 30 recent images by default for rollback. This phase grants only the EC2 host permission to authenticate to ECR and pull from that repository. It does not create GitHub OIDC or image-push permissions.

A future Cloudflare Tunnel process will create outbound connections on ports 443 or 7844 and provide application ingress without opening the EC2 security group. Cloudflare and application runtime configuration are intentionally deferred.

## Three separate S3 purposes

The bootstrap stack creates an S3 bucket used only for Terraform's production state. It has versioning, S3-managed encryption, public-access blocks, bucket-owner-enforced ownership, TLS-only access, and `prevent_destroy`. Production uses S3's native lockfile support (`use_lockfile = true`), so no DynamoDB locking table is created.

The production stack creates a different private S3 bucket for future PostgreSQL dumps under `postgresql/`. It has the same private/encrypted baseline, a configurable 90-day current-object retention period, 30-day noncurrent-version cleanup, and incomplete multipart-upload cleanup. The EC2 role can list that prefix and upload/read backup objects; it cannot make objects public or delete completed backups. This phase does not create backup scripts or schedules.

A third private bucket exists only for the `amazon.aws.aws_ssm` Ansible connection plugin. The plugin transfers Ansible module payloads through S3 using controller-generated presigned URLs because the host has no SSH path. Successful runs delete their objects normally; a one-day expiration and one-day incomplete-upload cleanup are fallback controls for interrupted runs. S3 lifecycle processing is asynchronous after objects become eligible, so this is not an exact deletion deadline. Versioning is deliberately disabled so deleted module payloads are not retained indefinitely. Terraform state and PostgreSQL backups are never reused for this transport traffic.

The EC2 role does not receive access to the Ansible transfer bucket. The plugin's controller identity needs `s3:GetBucketLocation` and `s3:ListBucket` on the bucket plus `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on its objects. Terraform creates a least-privilege managed policy for a future controller identity but does not attach it to the current operator or create any IAM user or access key. Operators may use existing short-lived or otherwise externally managed AWS credentials only when those credentials already have equivalent access.

Never store application secrets, database passwords, owner credentials, or Terraform credentials in either Terraform variables or committed files. Terraform state may contain infrastructure metadata and must still be treated as sensitive.

## Production secret parameters

Terraform owns two Standard-tier SSM Parameter Store `SecureString` resources encrypted with the default AWS-managed SSM key:

- `/personalhub/production/postgres/password`
- `/personalhub/production/cloudflare/tunnel-token`

Their values enter Terraform only through ephemeral, sensitive input variables and the AWS provider's write-only `value_wo` argument. Plaintext is therefore omitted from configuration, saved plans, output, and state. Creating or rotating either parameter requires supplying its ephemeral value and incrementing the corresponding non-secret write-only version variable. Operators should retrieve an existing value from SSM directly into process memory when a routine no-change plan needs the required ephemeral input; do not write it to a tfvars file.

The EC2 role can call only `ssm:GetParameter` and `ssm:GetParameters` on those two exact parameter ARNs. It has no wildcard Parameter Store access. The owner bootstrap password is deliberately excluded because it is a one-time interactive input, not a deployment secret.

The initial PostgreSQL password is generated locally with a cryptographically secure URL-safe generator and exists outside AWS only for the ephemeral Terraform handoff. The existing Cloudflare Tunnel token is read from a temporary owner-only file for the same handoff; that file is removed only after AWS confirms the parameter and the EC2 role proves it can retrieve it. Rotate either secret by supplying a new ephemeral value and incrementing only its corresponding write-only version. A future runtime phase may retrieve these parameters with the instance role and atomically materialize the minimum root-owned, mode-0600 configuration under `/etc/personalhub`; Terraform and Ansible variables must never contain the plaintext. Cloudflare tunnel/DNS configuration, PostgreSQL startup, Compose configuration, and owner initialization remain outside this secret-foundation phase.

## Prerequisites

- Terraform 1.11 or newer (required for ephemeral variables and write-only provider arguments; native S3 lockfiles require 1.10 or newer)
- AWS credentials supplied through the normal AWS SDK credential chain
- Permission to create the listed S3, VPC, EC2, IAM, ECR, and related resources in `ap-southeast-1`

No values must be changed for the agreed architecture. Optionally copy each `terraform.tfvars.example` to an ignored `terraform.tfvars` and adjust only non-secret settings.

## 1. Bootstrap the remote backend

Bootstrap state intentionally remains local.

```text
cd infra/terraform/bootstrap
terraform init
terraform fmt -check
terraform validate
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
terraform output
```

The bucket name combines the project, environment, and AWS account ID, making it globally unique without embedding a personal secret. After apply, capture the backend values:

```text
terraform output -raw state_bucket_name
terraform output -raw state_bucket_region
terraform output -raw production_backend_key
```

The bootstrap plan creates exactly six managed resources: one S3 bucket plus ownership controls, public-access blocking, versioning, encryption configuration, and a TLS-enforcement bucket policy. Bootstrap does not create DynamoDB.

## 2. Initialize and migrate production state

Copy the safe example, then replace only the bucket placeholder with `state_bucket_name` from bootstrap:

```text
cd ../production
cp backend.hcl.example backend.hcl
# Edit backend.hcl: set bucket to the bootstrap output.
terraform init -backend-config=backend.hcl
```

`backend.hcl` is ignored because it is generated for a particular account; it contains no credentials. On first initialization there is no production state to migrate. If local production state ever exists, rerun the command with `-migrate-state` and review Terraform's prompt. Do not copy or commit any `.tfstate` file.

For a changed backend configuration, use:

```text
terraform init -reconfigure -backend-config=backend.hcl
```

## 3. Production workflow

```text
terraform fmt -check -recursive ..
terraform validate
terraform plan -out=production.tfplan
# Apply only after reviewing the saved plan:
terraform apply production.tfplan
```

The production stack manages 36 resources after the Ansible transport and production-secret amendments:

- networking (13): VPC, Internet Gateway, subnet, route table, default route, route-table association, zero-ingress security group, and six explicit egress rules;
- IAM (4): EC2 role, SSM managed-policy attachment, least-privilege inline ECR/backup policy, and instance profile;
- registry (2): private ECR repository and lifecycle policy;
- backup storage (7): S3 bucket, ownership controls, public-access block, versioning, encryption, lifecycle configuration, and TLS-enforcement policy;
- Ansible transport (7): non-versioned S3 bucket, ownership controls, public-access block, encryption, one-day lifecycle cleanup, TLS-enforcement policy, and an unattached least-privilege controller policy;
- production secrets (2): write-only SSM SecureString parameters for the PostgreSQL password and existing Cloudflare Tunnel token;
- compute (1): ARM64 EC2 instance with its encrypted root EBS volume managed as part of the instance resource.

Useful outputs include the VPC and subnet IDs, security group ID, instance ID and public IP, ECR repository URL, backup and Ansible-transfer bucket names, controller policy ARN, IAM role name, and region. Outputs contain no secrets.

After an apply, allow the preinstalled Ubuntu SSM agent a few minutes to register, then verify that AWS reports the instance online before relying on it for administration:

```text
INSTANCE_ID=$(terraform output -raw ec2_instance_id)
aws ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=${INSTANCE_ID}" \
  --query 'InstanceInformationList[0].PingStatus' \
  --output text
aws ssm start-session --target "${INSTANCE_ID}"
```

The first command must return `Online`. Failure to register is an IAM, agent, DNS, routing, or outbound-connectivity problem; do not add SSH ingress as a workaround.

## Expected AWS cost surfaces

The main recurring costs are the `t4g.small` instance, its gp3 EBS volume, and the public IPv4 address. S3 backup/state/Ansible-transfer storage and requests, ECR image storage/scanning behavior, and internet data transfer vary with use. The transfer bucket should normally remain empty. The VPC, subnet, route table, Internet Gateway attachment, IAM role, security group, and basic Systems Manager node management do not by themselves add the cost of a NAT Gateway or load balancer. Check current `ap-southeast-1` pricing before apply.

## Safe destruction

Destroy production before bootstrap so Terraform can continue reading and updating remote state:

```text
cd infra/terraform/production
terraform plan -destroy -out=destroy.tfplan
terraform apply destroy.tfplan
```

The backup bucket has `prevent_destroy` and versioning. Preserve or explicitly remove its retained backups, then deliberately remove `prevent_destroy` from code only when permanent deletion is intended. The Ansible transfer bucket is non-versioned but retains `force_destroy = false`; allow lifecycle cleanup or remove abandoned transfer objects before destroying it. S3 refusing to delete a non-empty bucket is a safeguard, not an error to bypass casually.

Destroying bootstrap is a separate, last step. First retain a secure copy of any state you need, remove every state object version and lockfile only when certain they are no longer required, and deliberately remove the state bucket's `prevent_destroy`. Then plan and apply bootstrap destruction from its local state. Deleting the backend first strands production state and must be avoided.
