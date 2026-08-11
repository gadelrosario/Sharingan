import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Jonin432Tests(unittest.TestCase):
    def test_targeted_contracts(self):
        result = subprocess.run(
            ['node', 'tests/jonin-4-3-2-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=180,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual((payload['passCount'], payload['failCount']), (16, 0))


if __name__ == '__main__':
    unittest.main()
