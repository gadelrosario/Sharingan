import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class LivePlayerIntelligenceTests(unittest.TestCase):
    def test_fifty_deterministic_contracts(self):
        result = subprocess.run(
            ["node", "tests/live-player-intelligence-4-4-13-tests.js"],
            cwd=ROOT, text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Live player intelligence tests: 50/50 passed", result.stdout)

    def test_new_modules_are_cached_before_app_bundle(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        for source in (html, worker):
            self.assertLess(source.index("js/nfl-live-week-v1.js?v=1.0.0"), source.index("js/season-current-week-evidence-v1.js?v=1.1.0"))
            self.assertLess(source.index("js/season-current-week-evidence-v1.js?v=1.1.0"), source.index("js/app.js?v=4.4.13-live-player-intelligence-1"))


if __name__ == "__main__":
    unittest.main()
