import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class RosterViewTests(unittest.TestCase):
    def test_deterministic_slot_assignment(self):
        source="""global.window={};const fs=require('fs'),vm=require('vm');vm.runInThisContext(fs.readFileSync('js/roster-view-v1.js','utf8'));vm.runInThisContext(fs.readFileSync('tests/roster-view-tests.js','utf8'));const result=window.RosterViewTests.run();console.log(JSON.stringify(result));if(result.failCount)process.exit(1);"""
        result=subprocess.run([str(NODE),'-e',source],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn('"failCount":0',result.stdout)

    def test_live_panel_markup_and_update_contract(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8');app=(ROOT/'js/app.js').read_text(encoding='utf-8');css=(ROOT/'css/app.css').read_text(encoding='utf-8')
        self.assertIn('id="myTeamHeading"',html);self.assertIn('>MY TEAM</h2>',html);self.assertIn('aria-labelledby="mobileMyTeamHeading"',html)
        for container in ('roster','mobileLiveRoster','mRoster'): self.assertEqual(html.count(f'id="{container}"'),1)
        self.assertIn('function rosterViewState()',app);self.assertIn('RosterViewV1.assignSlots',app);self.assertIn('function rosterPanelMarkup()',app)
        self.assertIn('aria-label="Starting lineup"',app);self.assertIn('aria-label="Bench"',app);self.assertIn('Unresolved player ID',app)
        self.assertIn('renderRoster();renderLiveRoster()',app)
        undo=app.split('function undoLastPick',1)[1].split('function syncSearch',1)[0];self.assertIn('renderAll()',undo)
        start=app.split('function startDraft',1)[1].split('function backToSetup',1)[0];self.assertIn('renderAll()',start)
        self.assertIn('.myTeamSlot',css);self.assertIn('minmax(0,1fr)',css.replace(' ',''))

    def test_roster_assignment_does_not_mutate_players_or_scoring(self):
        source=(ROOT/'js/roster-view-v1.js').read_text(encoding='utf-8')
        self.assertNotIn('.rosterSlot=',source);self.assertNotIn('.slot=',source)
        self.assertNotIn('finalPickScore',source);self.assertNotIn('mambaScore',source)

    def test_real_player_manual_scenarios(self):
        source="""const roster=require('./js/roster-view-v1.js'),players=require('./data/players.json');const slots=['QB','RB1','RB2','WR1','WR2','WR3','TE','FLEX1','FLEX2','K','DEF','BENCH1','BENCH2','BENCH3','BENCH4','BENCH5','BENCH6'];const get=name=>players.find(p=>p.name===name),assign=names=>roster.assignSlots({slots,draftedEntries:names.map((name,index)=>({id:get(name).id,player:get(name),draftOrder:index+1}))}),at=(view,slot)=>view.allRows.find(row=>row.slot===slot);const gibbs=assign(['Jahmyr Gibbs']);if(at(gibbs,'RB1').player.name!=='Jahmyr Gibbs')process.exit(1);const foundation=['Jahmyr Gibbs','Bijan Robinson','Puka Nacua','CeeDee Lamb','Brock Bowers'],base=assign(foundation);if(at(base,'FLEX1').player||at(base,'WR3').player)process.exit(2);const thirdWr=assign([...foundation,"Ja'Marr Chase"]);if(at(thirdWr,'WR3').player.name!=="Ja'Marr Chase"||at(thirdWr,'FLEX1').player)process.exit(3);const flex=assign([...foundation,"Ja'Marr Chase",'Jaxon Smith-Njigba']);if(at(flex,'FLEX1').player.name!=='Jaxon Smith-Njigba')process.exit(4);const benched=assign([...foundation,"Ja'Marr Chase",'Jaxon Smith-Njigba','Amon-Ra St. Brown','Josh Allen','Garrett Wilson']);if(at(benched,'BENCH1').player.name!=='Garrett Wilson')process.exit(5);const undone=assign([...foundation,"Ja'Marr Chase"]);if(at(undone,'FLEX1').player)process.exit(6);if(JSON.stringify(flex)!==JSON.stringify(assign([...foundation,"Ja'Marr Chase",'Jaxon Smith-Njigba'])))process.exit(7);"""
        result=subprocess.run([str(NODE),'-e',source],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

if __name__=='__main__': unittest.main()
