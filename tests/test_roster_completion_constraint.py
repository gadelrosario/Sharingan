import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class RosterCompletionConstraintTests(unittest.TestCase):
    def test_deterministic_constraint_suite(self):
        result=subprocess.run([str(NODE),'tests/roster-completion-constraint-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn('10/10 passed',result.stdout)

    def test_full_mock_integration_suite(self):
        result=subprocess.run([str(NODE),'tests/roster-completion-integration-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn('5/5 passed',result.stdout)

    def test_recommendations_apply_constraint_before_decision_and_cards(self):
        app=(ROOT/'js/app.js').read_text()
        recommendations=app.split('function recommendations()',1)[1].split('function championshipDecision',1)[0]
        self.assertIn('completionConstrainedPool',recommendations)
        self.assertIn('finalizeRecommendations',recommendations)
        render=app.split('function renderRecommendation()',1)[1].split('function boardControlState',1)[0]
        self.assertIn('recs.slice(0,5)',render)

    def test_fight_card_and_recommendation_actions_share_selection_guard(self):
        app=(ROOT/'js/app.js').read_text()
        actions=app.split('function recordFightCardPlayer()',1)[1].split('function renderBoard()',1)[0]
        self.assertGreaterEqual(actions.count('recommendationSelectionAllowed(player)'),2)

    def test_rb_need_declines_after_starters_are_filled(self):
        source=(ROOT/'js/command-center-v1.js').read_text()
        script=f"""const fs=require('fs'),vm=require('vm');vm.runInThisContext(fs.readFileSync({str(ROOT/'js/command-center-v1.js')!r},'utf8'));const a=DraftCommandCenterV1.calculatePositionNeeds({{QB:1,RB:2,WR:3,TE:1,K:0,DST:0}},17,8);const b=DraftCommandCenterV1.calculatePositionNeeds({{QB:1,RB:5,WR:3,TE:1,K:0,DST:0}},17,12);if(a.RB!==0||b.RB!==0)process.exit(1);"""
        result=subprocess.run([str(NODE),'-e',script],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn("RB: counts.RB >= 2 ? 0",source)

if __name__=='__main__': unittest.main()
