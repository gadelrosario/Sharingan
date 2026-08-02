import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class TeamStrengthComparisonTests(unittest.TestCase):
    def test_fixed_denominator_invariants(self):
        result = subprocess.run(
            [str(NODE), 'tests/team-strength-comparison-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('8/8 passed', result.stdout)

    def test_recommendation_comparison_uses_configured_slots(self):
        app = (ROOT / 'js/app.js').read_text()
        comparison = app.split('function championshipDecision', 1)[1].split('function rationale', 1)[0]
        self.assertIn('strengthOptions={starterSlots:rosterSlots}', comparison)
        self.assertEqual(comparison.count('calculateTeamStrength'), 2)


if __name__ == '__main__':
    unittest.main()
