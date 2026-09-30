from pathlib import Path
import unittest

from jinja2 import Environment, StrictUndefined
import yaml


TEMPLATE = (
    Path(__file__).parents[1]
    / "roles/personalhub_runtime/templates/compose.production.yml.j2"
)


def render_compose() -> dict:
    rendered = Environment(undefined=StrictUndefined).from_string(
        TEMPLATE.read_text(encoding="utf-8")
    ).render(
        personalhub_postgres_image="postgres:test",
        personalhub_database_name="personalhub",
        personalhub_database_user="personalhub",
        personalhub_time_zone="Asia/Kuala_Lumpur",
        personalhub_cloudflared_image="cloudflared:test",
    )
    document = yaml.safe_load(rendered)
    if not isinstance(document, dict):
        raise AssertionError("rendered Compose definition is not a mapping")
    return document


class ProductionComposeTopologyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.compose = render_compose()

    def test_services_have_only_the_required_networks(self):
        services = self.compose["services"]
        self.assertEqual(services["postgres"]["networks"], ["backend"])
        self.assertEqual(
            services["app"]["networks"], ["backend", "app_egress"]
        )
        self.assertEqual(
            services["cloudflared"]["networks"], ["backend", "edge"]
        )

    def test_network_isolation_and_egress_are_explicit(self):
        networks = self.compose["networks"]
        self.assertEqual(
            networks["backend"],
            {"name": "personalhub-production-backend", "internal": True},
        )
        self.assertEqual(
            networks["app_egress"],
            {"name": "personalhub-production-app-egress"},
        )
        self.assertEqual(
            networks["edge"], {"name": "personalhub-production-edge"}
        )

    def test_no_service_publishes_host_ports(self):
        for name, service in self.compose["services"].items():
            with self.subTest(service=name):
                self.assertNotIn("ports", service)

    def test_postgres_uses_the_existing_named_volume(self):
        self.assertEqual(
            self.compose["volumes"]["postgres_data"]["name"],
            "personalhub-production-postgres-data",
        )
        self.assertEqual(
            self.compose["services"]["postgres"]["volumes"],
            ["postgres_data:/var/lib/postgresql/data"],
        )


if __name__ == "__main__":
    unittest.main()
