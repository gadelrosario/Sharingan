import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class MatchupProjectionCorrectness44114Tests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/matchup-projection-correctness-4-4-11-4-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload['passCount'], 14)
        self.assertEqual(payload['failCount'], 0)


if __name__ == '__main__':
    unittest.main()
