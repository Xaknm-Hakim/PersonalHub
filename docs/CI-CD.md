# Continuous integration and verified production release

## Phase boundary

Phase 2C.1 added application CI and a controlled, build-only GitHub Actions publication path. The build role still cannot deploy images, invoke Systems Manager, read production secrets, run production migrations, or restart production.

Phase 2C.2 added a separate manual `workflow_dispatch` deployment through a constrained SSM document and a host-owned transactional helper. Phase 2C.3 composes those proven publication and deployment workflows into an automatic release chain after successful CI on a `main` push. Manual publication and deployment remain available as operational recovery paths.

## Repository and action integrity

The workflows are scoped to the public GitHub repository `Xaknm-Hakim/PersonalHub`, whose default branch is `main`.

Every referenced GitHub Action is pinned to an immutable upstream commit SHA. The adjacent version comment records the upstream major release for maintainers, while the SHA prevents a mutable tag from silently changing executed code. Workflow updates must verify the upstream repository and reviewed commit before changing a pin.

## Application CI

`.github/workflows/ci.yml` runs for:

- every pull request;
- every push to `main`.

It has only `contents: read` permission and does not request an OIDC token or access AWS. The Ubuntu runner uses Node.js 22 and the locked npm dependency graph. The gates are:

1. `npm ci`;
2. unit tests;
3. disposable PostgreSQL integration tests;
4. ESLint;
5. TypeScript checking;
6. Prettier check;
7. Prisma schema validation and client generation with a non-secret build-only URL;
8. production build;
9. reviewed Chromium installation;
10. disposable production browser tests;
11. `git diff --check`.

The integration and browser harnesses create isolated PostgreSQL 16 containers with generated test-only credentials and remove their containers and volumes afterward. They never retrieve production configuration.

## GitHub OIDC trust

Terraform manages the account-level GitHub Actions OIDC provider for:

- issuer: `https://token.actions.githubusercontent.com`;
- audience: `sts.amazonaws.com`.

The dedicated role is:

`arn:aws:iam::210855481769:role/personalhub-production-github-build`

Its trust policy requires both the expected audience and this exact subject:

`repo:Xaknm-Hakim@210323710/PersonalHub@1375982542:ref:refs/heads/main`

GitHub currently emits this identity-qualified default subject for the repository. `210323710` is the immutable GitHub owner ID for `Xaknm-Hakim`, and `1375982542` is the immutable repository ID for `PersonalHub`; both are non-secret identity metadata verified through the GitHub API. The role accepts only that owner/repository identity on `refs/heads/main` and does not retain the older name-only subject as a fallback.

Therefore another repository, fork, organization repository, branch, tag, or pull-request context cannot assume the role. GitHub exchanges its short-lived OIDC identity for temporary AWS role credentials. No IAM user, access key, GitHub AWS access-key secret, or long-lived AWS credential is created.

The publication and deployment workflows verify that they run on `refs/heads/main`; that check does not configure GitHub branch protection. Protect `main` in the repository settings before treating it as a release-authority boundary.

## Build and deploy role separation

The build role can call global `ecr:GetAuthorizationToken`, which AWS does not support with repository resource scoping. These actions are restricted to the single `personalhub-production` ECR repository:

- layer existence and upload operations;
- `PutImage`;
- image and repository description;
- image-scan result reads;
- image/config download reads used for verification.

The role has no ECR delete permission and no permission for EC2, SSM, Parameter Store, backup S3, Terraform-state S3, IAM mutation, or Cloudflare. It cannot pull or restart production through an AWS management channel.

The independent deployment role is:

`arn:aws:iam::210855481769:role/personalhub-production-github-deploy`

It uses the same exact audience and identity-qualified `main` subject, but has a different capability: read-only inspection of only the PersonalHub ECR repository and `ssm:SendCommand` against both the exact production instance and the custom `personalhub-production-deploy` document. The document accepts only a lowercase 40-character `DeploySha` and invokes only `/usr/local/sbin/personalhub-deploy "$SSM_DeploySha"`. Command-status reads require AWS's unscoped status APIs. The deploy role has no Parameter Store, Secrets Manager, backup S3, EC2 mutation, IAM mutation, ECR authentication/push/delete, Session Manager, Cloudflare, Terraform-state, or direct database permission.

These roles intentionally split capabilities:

- build role: GitHub to one ECR repository for candidate publication;
- deploy role: GitHub to one fixed SSM deployment command on one production instance;
- EC2 role: ECR pull, the two required production parameters, and PostgreSQL backup storage.

GitHub tells the host only which reviewed SHA to deploy. The host role performs image pull, secret use, and pre-deployment backup without returning those credentials or secret values to GitHub.

## Controlled image publication

`.github/workflows/publish-image.yml` supports both `workflow_call` and `workflow_dispatch`. The automatic release passes the exact SHA reported by the successful CI run. A manual dispatch may provide a full lowercase main-branch SHA and otherwise publishes its own workflow revision. The workflow checks out that exact commit and proves it belongs to `main`; the IAM subject restriction independently enforces the workflow's `main` execution context.

The workflow repeats the application validation gates before publication, then:

1. obtains temporary AWS credentials through GitHub OIDC;
2. verifies the assumed role identity;
3. refuses to continue if the full Git SHA tag already exists;
4. authenticates Docker to private ECR;
5. configures reviewed QEMU and Buildx actions;
6. builds the production Dockerfile for `linux/arm64` on the GitHub runner;
7. publishes only `<repository>:<full-git-sha>` with OCI provenance, SBOM, source, and revision metadata;
8. verifies ECR tag immutability, index digest, ARM64 child manifest, source/revision labels, SLSA provenance, and the SPDX SBOM attestation;
9. waits for ECR scanning and fails verification on any Critical finding;
10. reports High, Medium, and Low counts without silently suppressing them.

The workflow never publishes or treats `latest` as a deployment identity. ECR tag immutability and a pre-upload tag check prevent replacement of an existing SHA artifact.

ECR can scan only after an image has been uploaded. A failed scan therefore leaves an immutable but rejected candidate in the repository. The separate Phase 2C.2 deployment workflow independently requires a completed scan with zero Critical findings before selecting any digest.

A successful standalone manual publication only creates a candidate artifact. In the automatic release chain, successful verified publication passes the same immutable SHA to the deployment workflow.

## Production deployment

`.github/workflows/deploy-production.yml` supports both `workflow_call` and `workflow_dispatch` and requires an exact lowercase 40-character Git SHA. Before sending an SSM command it proves that the commit exists and is reachable from `main`, the immutable ECR tag exists, exactly one `linux/arm64` image manifest exists, source and revision labels match, scanning is complete, and Critical findings are zero.

Automatic calls additionally read the current GitHub `main` ref immediately before `ssm:SendCommand`. If it differs from the release SHA, the workflow reports `SUPERSEDED`, does not invoke production, and succeeds because production did not fail. Manual calls intentionally omit this current-head condition so an operator can redeploy or roll back to a reviewed immutable main-history artifact.

The workflow assumes only the deploy role and invokes the fixed custom SSM document. It cannot send arbitrary shell content. It polls the command with a bounded timeout and exposes only safe release, digest, backup, migration, health, and rollback status fields.

The host helper serializes deployments with a non-blocking lock and then:

1. validates the exact SHA and fixed ECR repository;
2. verifies the current app, PostgreSQL, cloudflared, internal health, and public health;
3. resolves the candidate index digest and ARM64 manifest, pulls by immutable digest, and checks source/revision labels;
4. requires a new successful `personalhub-postgres-backup.service` run and records its S3 object;
5. runs only `prisma migrate deploy` in the candidate image;
6. atomically writes the exact candidate reference to `/etc/personalhub/release.env`;
7. force-recreates only the app service;
8. verifies bounded internal/public health and confirms PostgreSQL and cloudflared container identities did not change.

If post-switch application health fails, the helper atomically restores the prior immutable release, recreates only the app, and reports whether application rollback recovered health. It never automatically restores PostgreSQL. A migration may not be backward compatible with the previous application; if rollback health fails, the database remains untouched, the pre-deployment S3 backup remains the recovery anchor, and an operator must perform a separately reviewed recovery.

## Automatic green-main release

`.github/workflows/release-production.yml` listens only for completion of the workflow named `CI` on `main`. It accepts only a successful push run, captures that run's exact `head_sha`, and passes the same value explicitly to both reusable workflows:

```text
main push SHA
  -> CI for that SHA
  -> publish-image(image_sha = CI head SHA)
  -> provenance, SBOM, platform, label, and scan verification
  -> deploy-production(image_sha = CI head SHA, require_current_main = true)
  -> current-main comparison
  -> constrained SSM deployment
  -> host backup, migration, app switch, and health checks
```

The release workflow never derives a later SHA from its checkout or from the mutable branch name. Publication checks out the explicit SHA, image tags and labels use it, deployment verifies it, and the SSM document receives only that SHA. This prevents mixing a CI result, artifact, and deployment from different revisions.

Automatic runs share the `personalhub-production-release` concurrency group with `cancel-in-progress: false`. An in-progress release is never canceled because a newer commit arrives. An older run that reaches the pre-command current-head check after `main` advances reports `SUPERSEDED` and leaves production unchanged. GitHub may replace an older pending run in a concurrency group with a newer pending run; such a run has not published or deployed and its SHA has already been superseded.

No GitHub Environment approval is configured. The release needs no repository write permission and uses only `contents: read` and `id-token: write`. The called workflows assume the existing build and deploy roles respectively; no AWS permissions are combined or expanded.

## Operator commands

Observe CI and publication runs with authenticated GitHub tooling:

```text
gh run list --workflow ci.yml
gh run list --workflow release-production.yml
gh workflow run publish-image.yml --ref main -f image_sha=<full-git-sha>
gh run list --workflow publish-image.yml
gh run watch <run-id> --exit-status
gh workflow run deploy-production.yml --ref main -f image_sha=<full-git-sha>
gh run list --workflow deploy-production.yml
```

A normal `main` push requires no manual dispatch: successful exact-SHA CI automatically proceeds through verified publication and deployment. The two manual workflows remain separate operational tools for explicitly selected immutable SHAs; dispatch them only for a reviewed recovery or redeployment.
