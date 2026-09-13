import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SeasonCommandCenter44112Tests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run(
            ["node", "tests/season-command-center-4-4-11-2-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("36/36 Jōnin 4.4.11.2 contracts passed", result.stdout)

    def test_manual_module_loads_before_app(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertLess(html.index("js/manual-season-state-v1.js"), html.index("js/app.js"))


if __name__ == "__main__":
    unittest.main()
