# PersonalHub Ansible host configuration

Phase 2A configures the Terraform-managed Ubuntu 24.04 ARM64 host. Phase 2B adds the static production-runtime definition and root-only deployment helpers. Ansible does not select an application release, retrieve secrets during convergence, start containers, configure remotely managed Cloudflare hostname routes, initialize the owner, or change AWS infrastructure.

## Controller prerequisites

Use an isolated local Python environment:

```text
uv venv ~/.local/share/personalhub-ansible/venv
uv pip install --python ~/.local/share/personalhub-ansible/venv/bin/python -r requirements.txt
~/.local/share/personalhub-ansible/venv/bin/ansible-galaxy collection install \
  -r requirements.yml -p ~/.local/share/personalhub-ansible/collections
```

Install AWS's Session Manager plugin from its official RPM on Fedora:

```text
curl -o /tmp/session-manager-plugin.rpm \
  https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_64bit/session-manager-plugin.rpm
sudo dnf install /tmp/session-manager-plugin.rpm
session-manager-plugin --version
```

The controller also needs working AWS credentials with SSM session permissions and the five S3 operations documented in `docs/INFRASTRUCTURE.md` for the dedicated transfer bucket. No credential belongs in this directory.

Activate the tool environment before running commands:

```text
source ~/.local/share/personalhub-ansible/venv/bin/activate
cd infra/ansible
```

## SSM transport

Inventory targets EC2 instance ID `i-0c60a9a2bca804257`; the public IPv4 address is never used for management. `amazon.aws.aws_ssm` opens an SSM session and uses the private, non-versioned `personalhub-production-210855481769-ansible-ssm-xfer` bucket for transient Ansible module payloads. There is no SSH fallback, key, user, or port 22 dependency. Successful runs delete transfer objects; the bucket lifecycle handles abandoned objects after they become eligible.

Test transport before changing the host:

```text
ansible personalhub_hosts -m ansible.builtin.ping
ansible personalhub_hosts -m ansible.builtin.command -a 'uname -m'
```

If connection fails, verify the instance is `Online` in SSM, controller AWS credentials and transfer-bucket permissions, the Session Manager plugin path, regional settings, outbound HTTPS/S3 access, and the SSM agent. Do not add SSH ingress.

## Host configuration

Run from this directory:

```text
ansible-playbook --syntax-check playbooks/configure-host.yml
ansible-playbook playbooks/configure-host.yml
ansible-playbook playbooks/configure-host.yml
ansible-playbook playbooks/verify-host.yml
```

The second configuration run should report `changed=0`. Package metadata tasks use bounded cache handling; observational verification tasks explicitly report no change. Run `verify-host.yml` after the Phase 2B.4 deployment because it expects `app`, `postgres`, and `cloudflared` to be healthy.

Docker comes from Docker's official Ubuntu apt repository. The host installs Docker Engine, containerd, and the Compose plugin natively for ARM64. Buildx is omitted because routine production deployment will pull prebuilt ECR images rather than build on the host. AWS CLI v2 is installed from a pinned official ARM64 archive with a pinned SHA-256 checksum; it uses only the EC2 instance role.

## Runtime identity and directories

The system account `personalhub` has a locked password, `/usr/sbin/nologin`, and no SSH path. It owns runtime/deployment files and belongs to the `docker` group so later SSM-driven deployment commands can operate Compose without routine root use. Docker-group membership is effectively root-equivalent and must not be granted to untrusted users.

The Ubuntu image's SSH service and socket are disabled and masked. Systems Manager remains the only administrative transport, and the Terraform security group continues to expose no ingress rules.

```text
/opt/personalhub/           personalhub:personalhub 0750
/opt/personalhub/compose/   personalhub:personalhub 0750
/opt/personalhub/deploy/    personalhub:personalhub 0750
/opt/personalhub/backups/   personalhub:personalhub 0750
/etc/personalhub/           root:root               0700
```

`personalhub-materialize-runtime-env` retrieves only the PostgreSQL password through the instance role and writes `/etc/personalhub/runtime.env` atomically as `root:root` mode `0600`. The independent `personalhub-materialize-cloudflared-token` helper retrieves only the Cloudflare Tunnel token and writes `/etc/personalhub/cloudflared-token` with the same ownership and mode. Ansible installs both helpers but never retrieves either value. The deployment-owned `/etc/personalhub/release.env` selects an immutable ECR image and is intentionally outside Ansible ownership so later CI/CD can update releases without changing static host configuration. PostgreSQL data uses a named Docker volume, never the Git checkout or deployment directories.

The base role keeps UTC, starts systemd time synchronization, enables unattended security updates, and limits persistent journald use to 500 MiB or 14 days. It does not install UFW, fail2ban, SSH, monitoring agents, or perform a distribution upgrade.

The verification playbook checks ECR authorization without printing or storing the short-lived token and lists only the `postgresql/` backup prefix. A full backup IAM readiness test may upload a harmless object with the instance role, read it back, and then remove every object version with an authorized controller because the deliberately narrow EC2 policy does not include `s3:DeleteObject`. No long-lived AWS credentials are placed on the host.
