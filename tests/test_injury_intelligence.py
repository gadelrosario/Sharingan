import pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class InjuryIntelligenceTests(unittest.TestCase):
    def test_structure_provenance_transition_and_overlay(self):
        script="""const i=require('./js/injury-intelligence-v1');const rank={overall:20};const a=i.normalize({playerId:'42',currentlyInjured:true,injuryTiming:'training-camp',practiceStatus:'Limited',lastUpdated:'2026-08-08T10:00:00Z',sources:[{provider:'NFL',reliability:'official',reportedAt:'2026-08-08T09:00:00Z'}]});const b=i.transition(a,{practiceStatus:'Full',currentlyInjured:false,lastUpdated:'2026-08-09T10:00:00Z',sources:[{provider:'Team',reliability:'practice'}]});const c=i.withManualOverride(b,'Monitor','2026-08-09T12:00:00Z');if(a.sources[0].confidence!==100||b.history.length!==1||b.sources.length!==2||i.badge(c)!=='Monitor'||rank.overall!==20)process.exit(1);"""
        result=subprocess.run([str(NODE),'-e',script],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

if __name__=='__main__':unittest.main()
