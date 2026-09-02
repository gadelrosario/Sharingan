import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_node(path):
    result = subprocess.run(["node", str(ROOT / path)], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise AssertionError(result.stderr or result.stdout)
    return result.stdout.strip()


class DiscoveryBreakoutRadar4410Tests(unittest.TestCase):
    def test_discovery_contracts(self):
        self.assertIn("70/70 passed", run_node("tests/discovery-breakout-radar-4-4-10-tests.js"))

    def test_discovery_smoke_is_bounded_and_fast(self):
        payload = json.loads(run_node("scripts/run_discovery_radar_smoke_4_4_10.js"))
        self.assertEqual(payload["status"], "PASS")
        self.assertEqual(payload["players"], 10)
        self.assertLess(payload["meanMs"], 100)
        self.assertLessEqual(payload["topSignals"], 3)
        self.assertLessEqual(payload["emerging"], 5)
        self.assertLessEqual(payload["watchlist"], 5)

    def test_discovery_module_is_loaded_before_orchestration(self):
        html = (ROOT / "index.html").read_text()
        self.assertLess(html.index("js/discovery-breakout-radar-v1.js"), html.index("js/weekly-command-center-v1.js"))
        self.assertLess(html.index("js/weekly-command-center-v1.js"), html.index("js/app.js"))

    def test_discovery_has_a_dedicated_season_route(self):
        command_center = (ROOT / "js/season-command-center-v1.js").read_text()
        app = (ROOT / "js/app.js").read_text()
        self.assertIn("'discovery'", command_center)
        self.assertIn("Discovery Radar", app)
        self.assertIn("renderSeasonDiscovery", app)

    def test_discovery_authority_firewalls_are_visible_in_source(self):
        source = (ROOT / "js/discovery-breakout-radar-v1.js").read_text()
        for contract in ("recommendationAuthority:false", "transactionAuthority:false", "sharingan:false", "chidori:false", "yahooAvailabilityState"):
            self.assertIn(contract, source)

    def test_demo_fixture_is_sanitized_and_bounded(self):
        fixture = json.loads((ROOT / "tests/fixtures/discovery_radar_4_4_10.json").read_text())
        self.assertEqual(fixture["schemaVersion"], "fantasy-hq-season-evidence-1")
        self.assertEqual(len(fixture["canonicalPlayers"]), 10)
        self.assertEqual(len({player["playerId"] for player in fixture["canonicalPlayers"]}), 10)
        self.assertTrue(all("yahoo" not in json.dumps(player).lower() for player in fixture["canonicalPlayers"]))


if __name__ == "__main__":
    unittest.main()
