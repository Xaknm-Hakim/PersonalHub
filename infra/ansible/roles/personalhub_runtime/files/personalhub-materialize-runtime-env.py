#!/usr/bin/env python3
"""Materialize PersonalHub runtime configuration from exact instance-role SSM parameters."""

import base64
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NoReturn
from urllib.parse import quote

PARAMETER_NAMES = {
    "postgres_password": "/personalhub/production/postgres/password",
    "google_client_id": "/personalhub/production/google/client-id",
    "google_client_secret": "/personalhub/production/google/client-secret",
    "integration_encryption_key": "/personalhub/production/integration/encryption-key",
}
REGION = "ap-southeast-1"
CONFIG_ROOT = Path("/etc/personalhub")
RUNTIME_ENV = CONFIG_ROOT / "runtime.env"


def fail(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def get_parameter(name: str, label: str) -> str:
    result = subprocess.run(
        [
            "/usr/local/bin/aws",
            "ssm",
            "get-parameter",
            "--region",
            REGION,
            "--name",
            name,
            "--with-decryption",
            "--query",
            "Parameter.Value",
            "--output",
            "text",
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        fail(f"{label} parameter retrieval failed")
    return result.stdout.rstrip("\n")


def main() -> None:
    if os.geteuid() != 0:
        fail("runtime environment materialization requires root")

    password = get_parameter(PARAMETER_NAMES["postgres_password"], "PostgreSQL")
    client_id = get_parameter(PARAMETER_NAMES["google_client_id"], "Google client ID")
    client_secret = get_parameter(
        PARAMETER_NAMES["google_client_secret"], "Google client secret"
    )
    encryption_key = get_parameter(
        PARAMETER_NAMES["integration_encryption_key"], "Integration encryption key"
    )

    if not re.fullmatch(r"[A-Za-z0-9_-]{32,}", password):
        fail("PostgreSQL parameter failed the expected URL-safe format check")
    if not re.fullmatch(
        r"[A-Za-z0-9._-]+\.apps\.googleusercontent\.com", client_id
    ):
        fail("Google client ID parameter failed its format check")
    if not re.fullmatch(r"[A-Za-z0-9._-]{20,}", client_secret):
        fail("Google client secret parameter failed its format check")
    try:
        decoded_key = base64.b64decode(encryption_key, validate=True)
    except ValueError:
        fail("Integration encryption key parameter failed its format check")
    if len(decoded_key) != 32:
        fail("Integration encryption key parameter must encode exactly 32 bytes")

    encoded_password = quote(password, safe="")
    content = (
        f"PERSONALHUB_POSTGRES_PASSWORD={password}\n"
        "PERSONALHUB_DATABASE_URL="
        f"postgresql://personalhub:{encoded_password}@postgres:5432/personalhub?schema=public\n"
        f"PERSONALHUB_GOOGLE_CLIENT_ID={client_id}\n"
        f"PERSONALHUB_GOOGLE_CLIENT_SECRET={client_secret}\n"
        f"PERSONALHUB_INTEGRATION_ENCRYPTION_KEY={encryption_key}\n"
    )

    CONFIG_ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chown(CONFIG_ROOT, 0, 0)
    os.chmod(CONFIG_ROOT, 0o700)

    fd, temporary_name = tempfile.mkstemp(prefix=".runtime.env.", dir=CONFIG_ROOT)
    temporary_path = Path(temporary_name)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chown(temporary_path, 0, 0)
        os.replace(temporary_path, RUNTIME_ENV)
    finally:
        temporary_path.unlink(missing_ok=True)

    print("runtime-environment-materialized=PASS")


if __name__ == "__main__":
    main()
