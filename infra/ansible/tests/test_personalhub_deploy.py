from __future__ import annotations

import importlib.util
from importlib.machinery import SourceFileLoader
from pathlib import Path
import unittest


TEMPLATE = (
    Path(__file__).parents[1]
    / "roles/personalhub_runtime/templates/personalhub-deploy.py.j2"
)


def load_deploy_module():
    loader = SourceFileLoader("personalhub_deploy", str(TEMPLATE))
    spec = importlib.util.spec_from_loader("personalhub_deploy", loader)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load deployment helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeOperations:
    def __init__(self, module, *, fail_health: bool = False, fail_migration: bool = False):
        self.module = module
        self.fail_health = fail_health
        self.fail_migration = fail_migration
        self.events: list[str] = []
        self.previous = module.Release(
            sha="a" * 40,
            digest="sha256:" + "1" * 64,
        )
        self.candidate = module.Release(
            sha="b" * 40,
            digest="sha256:" + "2" * 64,
        )

    def preflight(self):
        self.events.append("preflight")
        return self.previous

    def verify_candidate(self, sha):
        self.events.append(f"verify:{sha}")
        return self.candidate

    def pull_candidate(self, candidate):
        self.events.append("pull")

    def create_backup(self):
        self.events.append("backup")
        return "s3://personalhub-production-210855481769-pg-backups/postgresql/scheduled/test.dump"

    def migrate(self, candidate):
        self.events.append("migrate")
        if self.fail_migration:
            raise self.module.DeploymentError("migration")

    def write_release(self, release):
        self.events.append(f"write:{release.sha}")

    def recreate_app(self):
        self.events.append("recreate")

    def verify_post_switch(self):
        self.events.append("health")
        if self.fail_health:
            raise self.module.DeploymentError("post-switch-health")

    def verify_rollback_health(self):
        self.events.append("rollback-health")


class DeploymentHelperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.deploy = load_deploy_module()

    def test_sha_validation_requires_exact_lowercase_full_sha(self):
        valid = "7be7652a107dcf5c83db1914313caae2abb1075f"
        self.assertEqual(self.deploy.validate_sha(valid), valid)
        for invalid in ("7be7652", "A" * 40, "g" * 40, valid + ";id", "latest"):
            with self.subTest(invalid=invalid):
                with self.assertRaises(self.deploy.DeploymentError):
                    self.deploy.validate_sha(invalid)

    def test_release_parser_accepts_only_fixed_repository_sha_and_digest(self):
        sha = "a" * 40
        digest = "sha256:" + "1" * 64
        expected = f"{self.deploy.IMAGE_REPOSITORY}:{sha}@{digest}"
        self.assertEqual(self.deploy.parse_release_reference(expected), self.deploy.Release(sha, digest))
        rejected = (
            f"other.invalid/repository:{sha}@{digest}",
            f"{self.deploy.IMAGE_REPOSITORY}:latest@{digest}",
            f"{self.deploy.IMAGE_REPOSITORY}:{sha}",
            f"{self.deploy.IMAGE_REPOSITORY}:{sha}@sha256:short",
        )
        for value in rejected:
            with self.subTest(value=value):
                with self.assertRaises(self.deploy.DeploymentError):
                    self.deploy.parse_release_reference(value)

    def test_migration_failure_stops_before_release_switch(self):
        operations = FakeOperations(self.deploy, fail_migration=True)
        with self.assertRaises(self.deploy.DeploymentError) as caught:
            self.deploy.deploy_transaction("b" * 40, operations)
        self.assertEqual(caught.exception.stage, "migration")
        self.assertEqual(caught.exception.rollback, "NOT_REQUIRED")
        self.assertEqual(
            operations.events,
            ["preflight", "verify:" + "b" * 40, "pull", "backup", "migrate"],
        )

    def test_failed_post_switch_health_restores_previous_release_and_app(self):
        operations = FakeOperations(self.deploy, fail_health=True)
        with self.assertRaises(self.deploy.DeploymentError) as caught:
            self.deploy.deploy_transaction("b" * 40, operations)
        self.assertEqual(caught.exception.stage, "post-switch-health")
        self.assertEqual(caught.exception.rollback, "PASS")
        self.assertEqual(
            operations.events,
            [
                "preflight",
                "verify:" + "b" * 40,
                "pull",
                "backup",
                "migrate",
                "write:" + "b" * 40,
                "recreate",
                "health",
                "write:" + "a" * 40,
                "recreate",
                "rollback-health",
            ],
        )

    def test_successful_transaction_orders_backup_migration_and_switch(self):
        operations = FakeOperations(self.deploy)
        result = self.deploy.deploy_transaction("b" * 40, operations)
        self.assertEqual(result.previous, operations.previous)
        self.assertEqual(result.current, operations.candidate)
        self.assertEqual(result.migration, "PASS")
        self.assertEqual(result.rollback, "NOT_REQUIRED")
        self.assertLess(operations.events.index("backup"), operations.events.index("migrate"))
        self.assertLess(operations.events.index("migrate"), operations.events.index("write:" + "b" * 40))


if __name__ == "__main__":
    unittest.main()
