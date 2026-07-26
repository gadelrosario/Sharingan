import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
def run_node(source): return subprocess.run([str(NODE),'-e',source],cwd=ROOT,text=True,capture_output=True,check=False)

class PlayerTierContractTests(unittest.TestCase):
    def test_deterministic_contract_suite(self):
        result=run_node("""global.window={};const fs=require('fs'),vm=require('vm');vm.runInThisContext(fs.readFileSync('js/player-tier-contract.js','utf8'));vm.runInThisContext(fs.readFileSync('tests/player-tier-contract-tests.js','utf8'));const result=window.PlayerTierContractTests.run();console.log(JSON.stringify(result));if(result.failCount)process.exit(1);""")
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(json.loads(result.stdout)['passCount'],14)

    def test_full_runtime_parity_and_expected_corrections(self):
        result=run_node("""const tiers=require('./js/player-tier-contract.js'),players=require('./data/players.json');const valid=new Set(['S','A','B','C','D','E','F']);const old=p=>{const t=String(p.posTier||p.overallTier||'C').toUpperCase();return valid.has(t)?t:'C'};const differences=players.filter(p=>old(p)!==tiers.getDecisionTier(p)).map(p=>({id:p.id,name:p.name,old:old(p),next:tiers.getDecisionTier(p),posTier:p.posTier,overallTier:p.overallTier}));const unintended=differences.filter(p=>valid.has(String(p.posTier||'').toUpperCase()));console.log(JSON.stringify({total:players.length,identical:players.length-differences.length,differences,unintended}));""")
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        report=json.loads(result.stdout)
        self.assertEqual(report['total'],249)
        self.assertEqual(report['unintended'],[])
        self.assertEqual(report['identical']+len(report['differences']),249)

    def test_eternal_and_mangekyo_boundaries_remain_compatible(self):
        players=json.loads((ROOT/'data/players.json').read_text(encoding='utf-8'))
        payload=json.dumps({'gibbs':next(p for p in players if p['name']=='Jahmyr Gibbs'),'jsn':next(p for p in players if p['name']=='Jaxon Smith-Njigba')})
        result=run_node(f"""global.window={{}};const fs=require('fs'),vm=require('vm'),players={payload};vm.runInThisContext(fs.readFileSync('js/player-tier-contract.js','utf8'));vm.runInThisContext(fs.readFileSync('js/flight-control-v1.js','utf8'));const g=window.PlayerTierContract.getDecisionTier(players.gibbs),j=window.PlayerTierContract.getDecisionTier(players.jsn);const ge=window.FlightControlV1.eternalMangekyoActive({{tier:g,overall:players.gibbs.overall,pick:10,score:85}}),je=window.FlightControlV1.eternalMangekyoActive({{tier:j,overall:players.jsn.overall,pick:30,score:89}});if(!ge||je||j!=='S')process.exit(1);""")
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

if __name__=='__main__': unittest.main()
