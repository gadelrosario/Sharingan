import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class CurrentWeekEvidenceTests(unittest.TestCase):
    def test_contracts(self):
        result = subprocess.run(
            ["node", "tests/current-week-evidence-4-4-12-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Current-week evidence tests: 22/22 passed", result.stdout)

    def test_position_battle_discloses_mixed_actual_projection_basis(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn(
            "Current-outlook basis: completed starters use actuals; unstarted starters use supported projections.",
            source,
        )


if __name__ == "__main__":
    unittest.main()
