import csv
import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


def capture():
    source="const {captureBaselines}=require('./tests/recommendation-baseline-harness.js');console.log(JSON.stringify(captureBaselines()));"
    result=subprocess.run([str(NODE),'-e',source],cwd=ROOT,text=True,capture_output=True,check=False)
    if result.returncode: raise AssertionError(result.stdout+result.stderr)
    return json.loads(result.stdout)


def scenario_row(snapshot):
    top=';'.join(f"{p['id']}:{p['name']}:{p['finalPickScore']}:{p['mambaScore']}:{p['decisionTier']}:{p['sharinganStage']}" for p in snapshot['topFive'])
    control=snapshot['fightControl'];primary=f"{control['primary']['id']}:{control['primary']['name']}"
    pivot='-' if not control['pivot'] else f"{control['pivot']['id']}:{control['pivot']['name']}"
    focus=snapshot.get('focus');focus_value='-' if not focus else f"{focus['id']}:{focus['finalPickScore']}:{focus['mambaScore']}:{focus['decisionTier']}:{focus['sharinganStage']}:{str(focus['eligible']).lower()}"
    return {'scenario':snapshot['name'],'pick':str(snapshot['currentPick']),'roster':json.dumps(snapshot['roster'],sort_keys=True,separators=(',',':')),'top_five':top,'action':control['action'],'primary':primary,'pivot':pivot,'mission':control['mission'],'focus':focus_value}


class RecommendationBaselineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.actual=capture()

    def test_thirteen_representative_scenarios_match_exactly(self):
        with (ROOT/'tests/fixtures/recommendation_scenarios.tsv').open(encoding='utf-8',newline='') as handle:
            expected=list(csv.DictReader(handle,delimiter='\t'))
        actual=[scenario_row(snapshot) for snapshot in self.actual['scenarios']]
        self.assertEqual(actual,expected)

    def test_full_pool_player_level_scoring_baseline(self):
        with (ROOT/'tests/fixtures/full_pool_scoring_baseline.tsv').open(encoding='utf-8',newline='') as handle:
            expected={int(row['id']):row for row in csv.DictReader(handle,delimiter='\t')}
        actual={row['id']:{'id':str(row['id']),'decision_tier':row['decisionTier'],'mamba_score':str(row['mambaScore']),'final_pick_score':str(row['finalPickScore']),'eligible':str(row['eligible']).lower()} for row in self.actual['fullPool']}
        differences=[]
        for player_id in sorted(set(expected)|set(actual)):
            if expected.get(player_id)!=actual.get(player_id): differences.append({'id':player_id,'expected':expected.get(player_id),'actual':actual.get(player_id)})
        self.assertEqual(differences,[],f'Player-level scoring changes:\n{json.dumps(differences,indent=2)}')
        self.assertEqual(len(actual),264)

    def test_eternal_mangekyo_and_undo_contracts(self):
        by_name={snapshot['name']:snapshot for snapshot in self.actual['scenarios']}
        self.assertEqual(by_name['gibbs-eternal-1-10']['focus']['sharinganStage'],'eternal')
        self.assertEqual(by_name['jsn-mangekyo-3-10']['focus']['sharinganStage'],'mangekyo')
        replay=by_name['undo-replay']['undoReplay']
        self.assertEqual(replay['before']['topFive'],replay['replayed']['topFive'])
        self.assertNotEqual(replay['before']['currentPick'],replay['undone']['currentPick'])

    def test_display_tiers_are_explicit_and_responsive_contract_is_unchanged(self):
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        css=(ROOT/'css/app.css').read_text(encoding='utf-8')
        display_sections=''.join([
            app.split('function tierBadge',1)[1].split('function positionTierCounts',1)[0],
            app.split('function sourceRankLabel',1)[1].split('function openScan',1)[0],
            app.split('function quickPickMarkup',1)[1].split('function renderQuickDraftBoard',1)[0],
        ])
        self.assertNotIn('p.posTier||p.overallTier',display_sections)
        self.assertIn('aria-label="Decision Tier ${t}"',app)
        self.assertIn('aria-label="Decision Tier ${decisionTier}"',app)
        self.assertIn('Position Tier ${positionTier',app)
        self.assertIn('.fightControlDecision',css)
        self.assertRegex(css,r'@media\s*\(max-width:\s*600px\)')
        self.assertRegex(app,r"advancedAnalysisExpanded\s*=\s*false")


if __name__=='__main__': unittest.main()
