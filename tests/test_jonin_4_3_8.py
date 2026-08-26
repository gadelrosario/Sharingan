import csv
import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class Jonin438Tests(unittest.TestCase):
    def test_targeted_league_economics_and_archetypes(self):
        result = subprocess.run(
            [str(NODE), 'tests/league-economics-4-3-8-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (14, 0), payload['failures'])

    def test_frozen_437_baseline_covers_both_profiles_and_draft_phases(self):
        with (ROOT / 'tests/fixtures/jonin_4_3_7_league_economics_baseline.tsv').open(
            encoding='utf-8', newline=''
        ) as source:
            rows = list(csv.DictReader(source, delimiter='\t'))
        self.assertEqual(len(rows), 12)
        expected = {'opening-2', 'middle-5', 'turn-10', 'early', 'middle', 'late'}
        for profile in ('primary', 'downey'):
            self.assertEqual({row['state'] for row in rows if row['profile'] == profile}, expected)

    def test_archetype_module_loads_before_app_and_is_cached(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        worker = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
        asset = 'js/recommendation-archetypes-v1.js?v=1.1.0'
        self.assertLess(html.index(asset), html.index('js/app.js?v=4.4.4.1'))
        self.assertIn(f"'./{asset}'", worker)

    def test_data_and_scoring_firewalls_remain_explicit(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        self.assertNotIn("leagueContext.scoring === 'full' && p.pos === 'WR'", app)
        self.assertNotIn("leagueContext.passTD === 6 && p.pos === 'QB'", app)
        self.assertIn("p.opportunityTrend", app)
        self.assertIn("RecommendationArchetypesV1.assign", app)


if __name__ == '__main__':
    unittest.main()
