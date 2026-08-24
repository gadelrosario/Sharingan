import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class SeasonRosterUXTests(unittest.TestCase):
    def test_deterministic_user_team_and_lineup_contracts(self):
        result = subprocess.run([str(NODE), 'tests/season-roster-4-4-1d-tests.js'], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (12, 0), payload)

    def test_production_views_use_shared_resolution_and_non_live_labels(self):
        app = (ROOT / 'js/app.js').read_text()
        self.assertIn("model.userTeamResolution?.status!=='RESOLVED'", app)
        self.assertIn("team.teamKey===model.userTeamResolution?.teamKey", app)
        self.assertIn('Projected lineup from Draft Snapshot', app)
        self.assertIn('Current Yahoo lineup unavailable until sync', app)
        self.assertIn("seasonPage==='team'", app)
        self.assertIn("seasonPage==='matchup'", app)
        self.assertIn('MY TEAM', app)
        self.assertIn("seasonLineupSection(card,'STARTERS',model.lineup.starters,model,{compact:true})", app)
        self.assertIn("seasonLineupSection(card,'BENCH',model.lineup.bench,model,{compact:true})", app)
        self.assertNotIn("filter(row=>row.player).slice(0,6)", app)

    def test_no_recommendation_authority_changed(self):
        source = (ROOT / 'js/season-command-center-v1.js').read_text().lower()
        for forbidden in ('mambascore(', 'finalpickscore(', 'recommendations()', 'championshipequity', 'teamfitscore'):
            self.assertNotIn(forbidden, source)

    def test_responsive_lineup_contract(self):
        css = (ROOT / 'css/app.css').read_text()
        self.assertIn('.seasonLineupRow', css)
        self.assertIn('.seasonMatchupRow', css)
        self.assertIn('@media(max-width:1100px)', css)
        self.assertIn('@media(max-width:720px)', css)
        self.assertIn('minmax(0,1fr)', css)
        self.assertIn('.seasonRosterSummary{align-self:start;height:auto;min-height:0}', css)


if __name__ == '__main__':
    unittest.main()
