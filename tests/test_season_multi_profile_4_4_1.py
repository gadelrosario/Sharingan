import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class SeasonMultiProfileRegressionTests(unittest.TestCase):
    def test_profile_switching_isolated_across_yahoo_and_archive_sources(self):
        result = subprocess.run(
            [str(NODE), 'tests/season-multi-profile-4-4-1-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (8, 0), payload)


if __name__ == '__main__':
    unittest.main()
