import pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class RankOverrideGuardrailTests(unittest.TestCase):
    def test_deep_source_tiers_are_not_neutralized(self):
        script="""const e=require('./js/jonin-decision-intelligence-v1');const common={rosterFitModifier:0,rosterBeforeScore:60,rosterAfterScore:61,marketPressure:20,survivalRisk:20,sameTierRemaining:3,nextTierDrop:5,expectedReplacementValue:50,positionDepth:20};const f=e.evaluate({...common,player:{id:1},overall:141,tier:'L',mamba:75,crossPositionBase:60}),c=e.evaluate({...common,player:{id:2},overall:75,tier:'G',mamba:85,crossPositionBase:80});if(!(c.scores.playerValue>f.scores.playerValue))process.exit(1);"""
        result=subprocess.run([str(NODE),'-e',script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_known_players_keep_source_order_without_contextual_override(self):
        script="""const {createHarness}=require('./tests/recommendation-baseline-harness');const h=createHarness({unified:true});h.configureFresh({pick:1,slot:10});const x=h.boundarySnapshot();const names=x.topFive.map(p=>p.name);if(names.includes('Jauan Jennings')||names.includes('Oronde Gadsden II'))process.exit(1);"""
        result=subprocess.run([str(NODE),'-e',script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_gadsden_and_jennings_do_not_leapfrog_source_peers(self):
        script="""const e=require('./js/jonin-decision-intelligence-v1'),players=require('./data/players.json');const common={rosterFitModifier:0,rosterBeforeScore:60,rosterAfterScore:61,marketPressure:25,survivalRisk:25,sameTierRemaining:2,nextTierDrop:8,expectedReplacementValue:55,positionDepth:20};const score=name=>{const p=players.find(x=>x.name===name);return e.evaluate({...common,player:p,overall:p.overall,tier:p.overallTier,mamba:80,crossPositionBase:75}).scores.playerValue};if(!(score('Harold Fannin Jr.')>score('Oronde Gadsden II')&&score('Tucker Kraft')>score('Oronde Gadsden II')&&score('George Kittle')>score('Oronde Gadsden II')))process.exit(1);const j=players.find(x=>x.name==='Jauan Jennings');if(j.overall!==203||j.posRank!==79||j.posTier!=='J')process.exit(2);"""
        result=subprocess.run([str(NODE),'-e',script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

if __name__=='__main__':unittest.main()
