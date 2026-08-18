import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class Jonin437Tests(unittest.TestCase):
    def test_multi_league_profile_contracts(self):
        result=subprocess.run([str(NODE),'tests/league-profiles-4-3-7-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'],payload['failCount']),(12,0),payload['failures'])

    def test_profile_module_is_loaded_before_app_and_cached(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        worker=(ROOT/'service-worker.js').read_text(encoding='utf-8')
        self.assertLess(html.index('js/league-profiles-v1.js'),html.index('js/app.js?v=4.3.8'))
        self.assertIn("'./js/league-profiles-v1.js?v=1.0.0'",worker)
        self.assertIn("fantasy-hq-jonin-4-3-8",worker)

    def test_profile_specific_context_reaches_existing_engine_inputs(self):
        app=(ROOT/'js'/'app.js').read_text(encoding='utf-8')
        for token in ("...activeProfileSettings()","leagueContext.scoring === 'full'","passingTD: leagueContext.passTD","startRB:leagueContext.startRB","startWR:leagueContext.startWR","flex:leagueContext.flex"):
            self.assertIn(token,app)
        self.assertIn('leagueProfileStore?.archiveKey(activeLeagueProfile?.id)',app)

    def test_no_strategy_weights_or_shared_data_are_profile_scoped(self):
        profiles=(ROOT/'js'/'league-profiles-v1.js').read_text(encoding='utf-8').lower()
        self.assertNotIn('data/players.json',profiles)
        self.assertNotIn('mambascore',profiles)

    def test_active_league_header_has_an_independent_shrinking_layout(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        css=(ROOT/'css'/'app.css').read_text(encoding='utf-8').replace(' ','')
        self.assertIn('class="headerLeagueContext"',html)
        self.assertIn('#appScreen.headerLeagueContext{display:grid;flex:11auto;min-width:0',css)
        self.assertIn('#appScreen.headerLeagueContext>span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',css)
        self.assertIn('#appScreen.headerLeague{grid-column:1/-1',css)
        self.assertIn('#appScreen.headerLeagueContext{margin-right:auto}',css)

if __name__=='__main__':unittest.main()
