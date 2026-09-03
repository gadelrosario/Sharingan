import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class WeeklyMatchupIntelligenceTests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run(
            [str(NODE), "tests/weekly-matchup-intelligence-4-4-11-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertGreaterEqual(report["passCount"], 40)
        self.assertEqual(report["failCount"], 0)

    def test_runtime_uses_normalized_evidence_and_honest_empty_state(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("WeeklyMatchupIntelligenceV1.evaluate", app)
        self.assertIn("MATCHUP INTELLIGENCE NOT YET AVAILABLE", app)
        self.assertNotIn("api.sleeper.app", app)
        self.assertIn("js/weekly-matchup-intelligence-v1.js", html)

    def test_ui_contract_is_synthesis_first_and_collapsed(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("WEEKLY MATCHUP OVERVIEW", app)
        self.assertIn("BIGGEST ADVANTAGE", app)
        self.assertIn("BIGGEST CHALLENGE", app)
        self.assertIn("START/SIT IMPLICATIONS", app)
        self.assertIn("Advanced Evidence", app)
        self.assertIn("Sources & Provenance", app)
        self.assertIn("MATCHUP QUALITY ≠ START/SIT DECISION", app)

    def test_rankings_are_not_matchup_inputs(self):
        source = (ROOT / "js" / "weekly-matchup-intelligence-v1.js").read_text(encoding="utf-8")
        for forbidden in ("fantasyland", "flockRank", "overallRank", "mamba", "championship"):
            self.assertNotIn(forbidden, source.lower())


if __name__ == "__main__":
    unittest.main()
