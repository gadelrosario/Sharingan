import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class AllTabRankingTests(unittest.TestCase):
    def test_all_tab_contracts(self):
        result=subprocess.run([str(NODE),'tests/all-tab-ranking-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout)
        self.assertEqual((payload['passCount'],payload['failCount']),(11,0))

    def test_all_uses_only_fantasyland_overall_rank(self):
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        comparator=app.split('function overallSourceRank',1)[1].split('function comparePositionBoard',1)[0]
        self.assertIn('fantasylandOverallRank',comparator)
        for forbidden in ('mambaScore','finalDecisionScore','rosterFitModifier','injury'):
            self.assertNotIn(forbidden,comparator)

if __name__=='__main__':unittest.main()
