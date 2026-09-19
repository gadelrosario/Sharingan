import hashlib
import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class StartSitDecisionExperience44113Tests(unittest.TestCase):
    def run_node(self, script):
        result = subprocess.run(
            [str(NODE), script], cwd=ROOT, text=True, capture_output=True,
            check=False, timeout=15
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_deterministic_lineup_contracts(self):
        result = self.run_node('tests/start-sit-decision-experience-4-4-11-3-tests.js')
        self.assertEqual(result['failCount'], 0)
        self.assertEqual(result['passCount'], 27)

    def test_review_fixture_is_explicit_and_complete(self):
        fixture = json.loads((ROOT / 'tests/fixtures/season_command_center_4_4_11_2.json').read_text())
        self.assertEqual(fixture['lineupReview']['scenario'], 'injured-starter')
        self.assertEqual(fixture['lineupReview']['label'], 'REVIEW FIXTURE LINEUP EVIDENCE')
        self.assertEqual(set(fixture['lineupReview']['evidence']), {row['canonicalPlayerId'] for row in fixture['roster']})
        self.assertEqual(fixture['projectionLabel'], 'REVIEW FIXTURE PROJECTION')

    def test_ui_synthesizes_one_decision_and_progressively_discloses(self):
        app = (ROOT / 'js/app.js').read_text()
        self.assertIn('WEEKLY LINEUP OPTIMIZER', app)
        self.assertIn('LINEUP LOOKS GOOD', app)
        self.assertIn('1 LINEUP CHANGE', app)
        self.assertIn('START/SIT COMPARISON', app)
        self.assertIn('View analysis', app)
        segment = app.split('function seasonLineupOptimizerCard', 1)[1].split('renderSeasonStartSit =', 1)[0]
        for diagnostic in ('normalized evidence', 'structural opportunity score', 'projection delta factor', 'engine contribution'):
            self.assertNotIn(diagnostic, segment.lower())

    def test_review_projection_isolated_from_normal_mode(self):
        app = (ROOT / 'js/app.js').read_text()
        self.assertIn("const value = Number(player?.projection), trusted = model?.reviewMode", app)
        self.assertIn("model?.snapshot?.provider === 'Yahoo'", app)
        self.assertIn("reviewMode: true", app)
        self.assertIn("authoritative: true", app)
        self.assertNotIn('localStorage.setItem(seasonReviewKey', app)

    def test_mobile_and_system_mutation_contract(self):
        css = (ROOT / 'css/app.css').read_text()
        self.assertIn('.seasonLineupOptimizer.compact', css)
        self.assertIn('.seasonLineupComparePair', css)
        self.assertIn('@media(max-width:720px)', css)
        self.assertIn('grid-template-columns:1fr', css)
        protected = ['data/rankings/ACTIVE_SNAPSHOT.json', 'data/championship_equity_2026.json', 'js/draft-strategy-engine-v1.js']
        for relative in protected:
            current = (ROOT / relative).read_bytes()
            baseline = subprocess.run(['git', 'show', f'HEAD:{relative}'], cwd=ROOT, capture_output=True, check=True).stdout
            self.assertEqual(hashlib.sha256(current).digest(), hashlib.sha256(baseline).digest(), relative)


if __name__ == '__main__':
    unittest.main()
