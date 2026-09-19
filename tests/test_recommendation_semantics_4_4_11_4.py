import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")


class RecommendationSemantics44114Tests(unittest.TestCase):
    @unittest.skipUnless(NODE, "node is required")
    def test_fourteen_deterministic_contracts(self):
        result = subprocess.run(
            [NODE, "tests/recommendation-semantics-4-4-11-4-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["passCount"], 14)
        self.assertEqual(payload["failCount"], 0)


if __name__ == "__main__":
    unittest.main()
