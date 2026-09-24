import json
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class SleeperProjectionContracts(unittest.TestCase):
    def test_deterministic_javascript_contracts(self):
        result = subprocess.run(
            ["node", "tests/sleeper-projection-4-4-14-tests.js"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Sleeper projection tests passed", result.stdout)

    def test_emmett_stable_identity(self):
        registry = json.loads((ROOT / "data/season_evidence/season_player_registry.json").read_text())
        player = next(row for row in registry["players"] if row["name"] == "Emmett Johnson")
        self.assertEqual(player["externalIds"]["sleeper"], "13337")
        self.assertEqual(player["externalIds"]["yahoo"], "42796")

    def test_weights_and_draft_logic_untouched_by_projection_module(self):
        start_sit = (ROOT / "js/start-sit-intelligence-v1.js").read_text()
        adapter = (ROOT / "js/sleeper-projection-adapter-v1.js").read_text()
        self.assertIn("projection:.09", start_sit)
        self.assertNotIn("recommendations(", adapter)
        self.assertNotIn("finalPickScore", adapter)

    def test_truthful_browser_labels_and_integration(self):
        app = (ROOT / "js/app.js").read_text()
        html = (ROOT / "index.html").read_text()
        self.assertIn("projection.label", app)
        self.assertIn("Sleeper Estimate", adapter := (ROOT / "js/sleeper-projection-adapter-v1.js").read_text())
        self.assertNotIn("Yahoo Projection", adapter)
        self.assertIn("js/sleeper-projection-adapter-v1.js", html)
        self.assertIn("projection: projectionRating", app)


if __name__ == "__main__":
    unittest.main()
