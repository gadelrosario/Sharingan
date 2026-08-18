import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class JoninFourTests(unittest.TestCase):
    def test_deterministic_decision_and_session_contracts(self):
        result=subprocess.run([str(NODE),'tests/jonin-4-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn('10 passed, 0 failed',result.stdout)

    def test_browser_integration_and_cache_contract(self):
        html=(ROOT/'index.html').read_text()
        app=(ROOT/'js/app.js').read_text()
        worker=(ROOT/'service-worker.js').read_text()
        for asset in ('js/draft-session-v1.js?v=1.2.0','js/league-profiles-v1.js?v=1.0.0','js/jonin-decision-intelligence-v1.js?v=1.0.3','js/draft-grading-engine-v1.js?v=1.0.0','js/roster-completion-constraint-v1.js?v=1.1.0','js/app.js?v=4.3.7'):
            self.assertIn(asset,html)
            self.assertIn('./'+asset,worker)
        for required in ('persistDraftSession','resumeSavedDraft','confirmStartNewDraft','beforeunload','renderDraftTimeline','saveDraftNotebook','championshipDecision'):
            self.assertIn(required,app)
        self.assertIn('fantasy-hq-jonin-4-3-7',worker)

    def test_player_pool_identity_search_and_required_players(self):
        players=json.loads((ROOT/'data/players.json').read_text())
        ids=[str(player['id']) for player in players]
        identities=[(' '.join(player['name'].lower().replace('.','').split()),player['pos'].upper()) for player in players]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertEqual(len(identities),len(set(identities)))
        lookup={(player['name'],player['pos']):player for player in players}
        self.assertIn(('Mark Andrews','TE'),lookup)
        self.assertIn(('Jordan Love','QB'),lookup)
        self.assertIn('buildPlayerSearchIndex', (ROOT/'js/app.js').read_text())
        self.assertIn('__stableId', (ROOT/'js/app.js').read_text())

if __name__=='__main__': unittest.main()
