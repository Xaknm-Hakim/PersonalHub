#!/usr/bin/env python3
"""Materialize the Cloudflare Tunnel token from instance-role SSM access."""

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NoReturn

PARAMETER_NAME = "/personalhub/production/cloudflare/tunnel-token"
REGION = "ap-southeast-1"
CONFIG_ROOT = Path("/etc/personalhub")
TOKEN_FILE = CONFIG_ROOT / "cloudflared-token"


def fail(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if os.geteuid() != 0:
        fail("cloudflared token materialization requires root")

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
        fail("Cloudflare Tunnel parameter retrieval failed")

    token = result.stdout.rstrip("\n")
    if (
        not 20 <= len(token) <= 4096
        or any(character.isspace() for character in token)
        or any(ord(character) < 32 or ord(character) == 127 for character in token)
    ):
        fail("Cloudflare Tunnel parameter failed the expected format check")

    CONFIG_ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chown(CONFIG_ROOT, 0, 0)
    os.chmod(CONFIG_ROOT, 0o700)

    fd, temporary_name = tempfile.mkstemp(prefix=".cloudflared-token.", dir=CONFIG_ROOT)
    temporary_path = Path(temporary_name)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(token)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chown(temporary_path, 0, 0)
        os.replace(temporary_path, TOKEN_FILE)
    finally:
        temporary_path.unlink(missing_ok=True)

    print("cloudflared-token-materialized=PASS")


if __name__ == "__main__":
    main()
