import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class YahooLiveShapeContracts(unittest.TestCase):
    def test_live_shape_contracts(self):
        result = subprocess.run(
            ["node", "tests/yahoo-live-shape-4-4-11-4-tests.js"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        report = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(report["passCount"], 18)
        self.assertEqual(report["failCount"], 0)


if __name__ == "__main__":
    unittest.main()
