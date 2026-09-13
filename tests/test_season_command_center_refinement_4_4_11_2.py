import subprocess
import unittest


class SeasonCommandCenterRefinementTests(unittest.TestCase):
    def test_refinement_contracts(self):
        result = subprocess.run(
            ["node", "tests/season-command-center-refinement-4-4-11-2-tests.js"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("15/15 Season refinement contracts passed", result.stdout)


if __name__ == "__main__":
    unittest.main()
