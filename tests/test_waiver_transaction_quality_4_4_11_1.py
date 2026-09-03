import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WaiverTransactionQualityTests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run(
            ["node", "tests/waiver-transaction-quality-4-4-11-1-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        payload = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(payload["failCount"], 0)
        self.assertEqual(payload["passCount"], 32)

    def test_season_ui_uses_compact_transaction_contract(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertIn("seasonWaiverContext", app)
        self.assertIn("Net roster effect:", app)
        self.assertIn("summary.textContent='Detailed analysis'", app)
        self.assertIn("transaction.valueEfficiency", app)
        self.assertLess(
            html.index("js/waiver-transaction-quality-v1.js?v=1.0.0"),
            html.index("js/waiver-intelligence-v1.js?v=1.1.0"),
        )
        self.assertIn("./js/waiver-transaction-quality-v1.js?v=1.0.0", worker)


if __name__ == "__main__":
    unittest.main()
