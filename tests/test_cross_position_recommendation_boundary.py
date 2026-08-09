import json
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


def run_node(source):
    result = subprocess.run([str(NODE), '-e', source], cwd=ROOT, text=True, capture_output=True, check=False)
    if result.returncode:
        raise AssertionError(result.stdout + result.stderr)
    return json.loads(result.stdout)


class CrossPositionRecommendationBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
        cls.engine = (ROOT / 'js' / 'jonin-decision-intelligence-v1.js').read_text(encoding='utf-8')
        source = """
const {createHarness}=require('./tests/recommendation-baseline-harness.js');
const harness=createHarness({unified:true});
const snapshots=[1,5,10].map(pick=>{harness.configureFresh({pick,slot:pick,startQB:1});return {pick,...harness.boundarySnapshot()}});
harness.configureFresh({pick:5,slot:5,startQB:1});
const repeat=harness.boundarySnapshot();
console.log(JSON.stringify({snapshots,repeat}));
"""
        cls.results = run_node(source)

    def test_cross_position_blend_uses_only_overall_rank_inputs(self):
        blend = self.app.split('function overallSourceBlend', 1)[1].split('function sourceBlend', 1)[0]
        self.assertIn('p.overall', blend)
        self.assertIn('p.fantasyProsOverallRank', blend)
        for positional in ('posRank', 'fantasyProsPosRank', 'bdgeRank', 'flockRank'):
            self.assertNotIn(positional, blend)
        self.assertIn('function positionalSourceBlend', self.app)

    def test_qb1_is_not_interpreted_as_overall_one(self):
        josh = self.results['snapshots'][1]['josh']
        self.assertEqual((josh['overall'], josh['posRank']), (32, 1))
        self.assertLess(josh['overallSourceBlend'], josh['positionalSourceBlend'])
        self.assertLess(josh['crossPositionBase'], josh['mamba'])

    def test_overall_tier_crosses_boundary_while_position_tier_stays_for_scarcity(self):
        boundary = self.app.split('function championshipDecision', 1)[1].split('function rationale', 1)[0]
        self.assertIn('overallTier=PlayerTierContract.getOverallTier(player)', boundary)
        self.assertIn("decisionOverallTier=['K','DST'].includes(position)?'F':overallTier", boundary)
        self.assertIn('tier:decisionOverallTier', boundary)
        self.assertIn('positionTier', boundary)
        self.assertIn('tierLabel(candidate)===positionTier', boundary)
        josh = self.results['snapshots'][1]['josh']
        self.assertEqual((josh['overallTier'], josh['posTier']), ('D', 'S'))

    def test_fresh_picks_are_deterministic_and_corrected_inputs_remove_qb_leakage(self):
        snapshots = self.results['snapshots']
        self.assertEqual([row['pick'] for row in snapshots], [1, 5, 10])
        for row in snapshots:
            self.assertEqual(len(row['topFive']), 5)
            self.assertNotEqual(row['topFive'][0]['id'], row['josh']['id'])
            self.assertLess(row['josh']['scores']['playerValue'], row['topFive'][0]['scores']['playerValue'])
        self.assertEqual(snapshots[1]['topFive'], self.results['repeat']['topFive'])

    def test_superflex_fixture_can_raise_qb_only_through_explicit_scarcity(self):
        source = """
const engine=require('./js/jonin-decision-intelligence-v1.js');
const base={player:{id:32,pos:'QB'},overall:32,tier:'E',positionTier:'S',mamba:97,crossPositionBase:88.63,rosterFitModifier:5,rosterBeforeScore:0,rosterAfterScore:78,sameTierRemaining:0,nextTierDrop:12,expectedReplacementValue:83,positionDepth:34};
const oneQb=engine.evaluate({...base,leagueFormat:'ONE_QB',marketPressure:25,survivalRisk:25});
const superflex=engine.evaluate({...base,leagueFormat:'SUPERFLEX',marketPressure:90,survivalRisk:90});
console.log(JSON.stringify({oneQb:oneQb.scores,superflex:superflex.scores}));
"""
        result = run_node(source)
        self.assertEqual(result['oneQb']['playerValue'], result['superflex']['playerValue'])
        self.assertGreater(result['superflex']['opportunityCost'], result['oneQb']['opportunityCost'])
        self.assertGreater(result['superflex']['championship'], result['oneQb']['championship'])

    def test_ui_surfaces_remain_synchronized_to_engine_primary(self):
        render = self.app.split('function renderRecommendation()', 1)[1].split('function boardControlState', 1)[0]
        self.assertIn('const primary = recs[0]', render)
        self.assertIn('displayed = selected || primary', render)
        self.assertIn('alternativeDecisionMarkup(candidateModel', render)
        self.assertIn('DOM.recordPickBtn.dataset.playerId=displayed?.id??', self.app)


if __name__ == '__main__':
    unittest.main()
