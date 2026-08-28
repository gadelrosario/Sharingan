import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class NflverseEvidenceFoundationTests(unittest.TestCase):
    def run_node(self, script):
        completed = subprocess.run(
            ["node", script], cwd=ROOT, text=True, capture_output=True, check=False
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        return completed.stdout

    def test_deterministic_adapter_contracts(self):
        output = self.run_node("tests/nflverse-evidence-4-4-9-tests.js")
        report = json.loads(output.strip().splitlines()[-1])
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["passCount"], 15)
        self.assertFalse(report["recommendationAuthority"])

    def test_refresh_is_local_and_fail_safe(self):
        source = (ROOT / "scripts" / "update_nfl_evidence.js").read_text(encoding="utf-8")
        self.assertIn("writeAtomically", source)
        self.assertIn("last-valid outputs were preserved", source)
        self.assertIn("--stats-input", source)
        self.assertNotIn("localStorage", source)

    def test_app_startup_does_not_require_the_provider(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("ensureSeasonEvidenceStore", source)
        self.assertNotIn("nflverse-data/releases", source)
        self.assertIn("Optional local NFL evidence could not load; Season and Draft modes remain available", source)

    def test_settings_status_distinguishes_provider_and_authority(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("NFL evidence provider", source)
        self.assertIn("Last successful refresh", source)
        self.assertIn("Yahoo league state", source)
        self.assertIn("recommendation authority is disabled", source)

    def test_demo_and_real_import_paths_are_separate(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("state:'DEMO'", source)
        self.assertIn("state:result.accepted||result.idempotent?'IMPORTED':'EMPTY'", source)
        self.assertIn("data/season_evidence/nflverse_latest.json", source)

    def test_browser_loads_only_the_bounded_local_artifact(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertIn("js/nflverse-evidence-adapter-v1.js", html)
        self.assertIn("js/season-player-registry-v1.js", html)
        self.assertIn("data/season_evidence/nflverse_latest.json", worker)
        self.assertIn("data/season_evidence/season_player_registry.json", worker)
        self.assertNotIn("github.com/nflverse", html + worker)

    def test_source_and_yahoo_authority_remain_separate(self):
        source = (ROOT / "js" / "nflverse-evidence-adapter-v1.js").read_text(encoding="utf-8")
        self.assertIn("recommendationAuthority:false", source)
        self.assertNotIn("availability", source)
        self.assertNotIn("ownership", source)
        self.assertNotIn("faab", source.lower())

    def test_bundled_real_artifact_is_bounded_and_shadow_only(self):
        artifact = json.loads((ROOT / "data" / "season_evidence" / "nflverse_latest.json").read_text(encoding="utf-8"))
        self.assertEqual(artifact["provider"], "nflverse")
        self.assertEqual(artifact["season"], 2025)
        self.assertEqual(artifact["weeks"], [16, 17, 18])
        self.assertEqual(artifact["recordCount"], len(artifact["records"]))
        self.assertLess(len(artifact["records"]), 1500)
        self.assertFalse(artifact["recommendationAuthority"])


if __name__ == "__main__":
    unittest.main()
