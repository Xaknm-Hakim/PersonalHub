#!/usr/bin/env python3
"""Materialize the minimum PersonalHub runtime environment from instance-role SSM access."""

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NoReturn
from urllib.parse import quote

PARAMETER_NAME = "/personalhub/production/postgres/password"
REGION = "ap-southeast-1"
CONFIG_ROOT = Path("/etc/personalhub")
RUNTIME_ENV = CONFIG_ROOT / "runtime.env"


def fail(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if os.geteuid() != 0:
        fail("runtime environment materialization requires root")

    result = subprocess.run(
        [
            "/usr/local/bin/aws",
            "ssm",
            "get-parameter",
            "--region",
            REGION,
            "--name",
            PARAMETER_NAME,
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
        fail("PostgreSQL parameter retrieval failed")

    password = result.stdout.rstrip("\n")
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,}", password):
        fail("PostgreSQL parameter failed the expected URL-safe format check")

    encoded_password = quote(password, safe="")
    content = (
        f"PERSONALHUB_POSTGRES_PASSWORD={password}\n"
        "PERSONALHUB_DATABASE_URL="
        f"postgresql://personalhub:{encoded_password}@postgres:5432/personalhub?schema=public\n"
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
