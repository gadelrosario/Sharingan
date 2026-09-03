import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WeeklyCommandCenter448Tests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run(
            ["node", "tests/weekly-command-center-4-4-8-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        report = json.loads(result.stdout)
        self.assertGreaterEqual(report["passCount"], 23)
        self.assertEqual(report["failCount"], 0)

    def test_fixture_has_sixteen_scenarios(self):
        payload = json.loads((ROOT / "tests/fixtures/weekly_command_center_4_4_8.json").read_text())
        self.assertEqual(payload["schema"], "fantasy-hq-weekly-command-center-fixture-1")
        self.assertEqual(len(payload["scenarios"]), 16)

    def test_browser_integration_is_downstream_and_cached(self):
        app = (ROOT / "js/app.js").read_text()
        html = (ROOT / "index.html").read_text()
        worker = (ROOT / "service-worker.js").read_text()
        self.assertIn("function seasonWeeklyCommandInput(model)", app)
        self.assertIn("FantasyHQWeeklyCommandCenterV1.orchestrate", app)
        self.assertIn("FLIGHT CONTROL — WEEKLY PRIORITY", app)
        self.assertIn("WEEKLY ACTION QUEUE", app)
        self.assertIn('js/weekly-command-center-v1.js?v=1.1.0', html)
        self.assertIn('./js/weekly-command-center-v1.js?v=1.1.0', worker)
        self.assertLess(html.index("js/faab-intelligence-v1.js"), html.index("js/weekly-command-center-v1.js"))
        self.assertLess(html.index("js/weekly-command-center-v1.js"), html.index("js/app.js"))

    def test_bounded_smoke(self):
        result = subprocess.run(
            ["node", "scripts/run_weekly_command_center_smoke_4_4_8.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        report = json.loads(result.stdout)
        self.assertEqual(report["scenarioCount"], 16)
        self.assertFalse(report["inputMutation"])
        self.assertLess(report["averageMs"], 5)

    def test_season_home_convergence_contracts(self):
        app = (ROOT / "js/app.js").read_text()
        css = (ROOT / "css/app.css").read_text()
        html = (ROOT / "index.html").read_text()
        self.assertIn("seasonWeeklyQueue-${kind}", app)
        self.assertIn("'action'", app)
        self.assertIn("'watch'", app)
        self.assertIn("'ignore'", app)
        self.assertIn("seasonWeeklyIgnoreDisclosure", app)
        self.assertIn("low-priority items", app)
        self.assertIn("aria-label", app)
        self.assertIn("seasonMarkFlightControlDuplicates", app)
        self.assertIn("Tracked by Weekly Flight Control", app)
        self.assertIn("seasonHomeConverged", app)
        self.assertIn(".seasonWeeklyQueueGrid{grid-template-columns:minmax(0,1fr) minmax(220px,.42fr)", css)
        self.assertIn(".seasonWeeklyQueue-watch{display:grid;grid-column:1/-1", css)
        self.assertIn(".seasonWeeklyIgnoreDisclosure summary:focus-visible", css)
        self.assertIn(".seasonHomeWaiver.seasonTrackedByFlight .seasonHomeDecisionReason", css)
        self.assertIn("css/app.css?v=4.4.11.1", html)
        self.assertIn("js/app.js?v=4.4.11.1", html)


if __name__ == "__main__":
    unittest.main()
