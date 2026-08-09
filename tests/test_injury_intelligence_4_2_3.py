import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class InjuryIntelligence423Tests(unittest.TestCase):
    def test_injury_decision_contracts(self):
        result=subprocess.run([str(NODE),'tests/injury-intelligence-4-2-3-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout)
        self.assertEqual((payload['passCount'],payload['failCount']),(10,0))

    def test_production_score_and_debug_use_injury_adjustment(self):
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        final=app.split('function finalDecisionTrace',1)[1].split('function finalPickScore',1)[0]
        self.assertIn('modifiers.injury.adjustment',final)
        debug=app.split('function recommendationDebugBreakdown',1)[1].split('function rationale',1)[0]
        for field in ('footballAvailability','rosterAvailability','riskAdjustment','irCapacityEffect','portfolioEffect','finalAdjustment'):
            self.assertIn(field,debug)

    def test_empty_snapshot_applies_unknown_not_healthy(self):
        script="""const i=require('./js/injury-intelligence-v1'),p=[{id:1},{id:2}],s={records:[]},r=i.applySnapshot(p,s);if(r.unknown!==2||p.some(x=>x.injury.status!=='UNKNOWN'))process.exit(1);"""
        result=subprocess.run([str(NODE),'-e',script],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

if __name__=='__main__':unittest.main()
