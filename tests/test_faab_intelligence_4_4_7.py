import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FAABIntelligence447Tests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run(
            ["node", "tests/faab-intelligence-4-4-7-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        report = json.loads(result.stdout)
        self.assertGreaterEqual(report["passCount"], 27)
        self.assertEqual(report["failCount"], 0)

    def test_fixture_has_twenty_four_scenarios(self):
        fixture = json.loads((ROOT / "tests/fixtures/faab_intelligence_4_4_7.json").read_text())
        self.assertEqual(fixture["schema"], "fantasy-hq-faab-fixture-1")
        self.assertEqual(len(fixture["scenarios"]), 24)

    def test_browser_integration_is_downstream_and_cached(self):
        app = (ROOT / "js/app.js").read_text()
        html = (ROOT / "index.html").read_text()
        worker = (ROOT / "service-worker.js").read_text()
        self.assertIn("function seasonFaabEvaluation(model,pair)", app)
        self.assertIn("FAAB prices the existing Waiver decision only", app)
        self.assertIn('js/faab-intelligence-v1.js?v=1.1.0', html)
        self.assertIn('./js/faab-intelligence-v1.js?v=1.1.0', worker)
        self.assertLess(html.index("js/waiver-intelligence-v1.js"), html.index("js/faab-intelligence-v1.js"))

    def test_bounded_smoke(self):
        result = subprocess.run(
            ["node", "scripts/run_faab_intelligence_smoke_4_4_7.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        report = json.loads(result.stdout)
        self.assertEqual(report["scenarioCount"], 24)
        self.assertFalse(report["inputMutation"])
        self.assertLess(report["averageMs"], 5)


if __name__ == "__main__":
    unittest.main()
