import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class RecommendationRegression421Tests(unittest.TestCase):
    def test_deterministic_regressions(self):
        result=subprocess.run([str(NODE),'tests/recommendation-regression-4-2-1-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout)
        self.assertEqual((payload['passCount'],payload['failCount']),(10,0))

    def test_search_handler_exists_and_all_inline_references_resolve(self):
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertIn('function handleSearchKey(event)',app)
        self.assertEqual(html.count('onkeydown="handleSearchKey(event)"'),3)

    def test_fight_card_and_record_target_share_displayed_player(self):
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        render=app.split('function renderRecommendation()',1)[1].split('function boardControlState',1)[0]
        self.assertIn('const primary = recs[0]',render)
        self.assertIn('displayed = selected || primary',render)
        self.assertIn('updateDraftDecisionChrome(model,displayed,primary)',render)
        self.assertIn("DOM.recordPickBtn.dataset.playerId=displayed?.id??''",app)

    def test_version_and_cache_are_4_3(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        worker=(ROOT/'service-worker.js').read_text(encoding='utf-8')
        self.assertIn('<small data-app-version></small>',html)
        self.assertIn('js/app.js?v=4.3.7',html)
        self.assertIn("fantasy-hq-jonin-4-3-7",worker)

if __name__=='__main__': unittest.main()
