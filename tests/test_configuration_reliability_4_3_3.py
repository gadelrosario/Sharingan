import json
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class ConfigurationReliabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
        cls.html = (ROOT / 'index.html').read_text(encoding='utf-8')

    def run_node(self, script):
        result = subprocess.run([str(NODE), '-e', script], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def test_tracker_uses_active_slots_for_mock_and_live(self):
        tracker = self.app.split('function liveTeamTrackerMarkup', 1)[1].split('function renderWaitMeter', 1)[0]
        self.assertIn('state=rosterViewState()', tracker)
        self.assertIn('state.starters.map', tracker)
        self.assertNotIn('state.starters.filter', tracker)
        self.assertNotIn("['QB','RB1','RB2','WR1','WR2','TE','FLEX1','DEF','K']", tracker)
        self.assertNotIn('mode===', tracker.replace(' ', ''))
        start = self.app.split('function startDraft', 1)[1].split('function backToSetup', 1)[0]
        self.assertIn('applyDraftStructure()', start)
        self.assertIn('renderAll()', start)

    def test_roster_shapes_switch_without_stale_slots(self):
        self.run_node(r"""
const fs=require('fs'),vm=require('vm'),roster=require('./js/roster-view-v1.js');
const app=fs.readFileSync('js/app.js','utf8'),start=app.indexOf('function buildRosterSlots'),end=app.indexOf('\nfunction applyDraftStructure',start);
vm.runInThisContext(app.slice(start,end));
const baseline={startQB:1,startRB:2,startWR:2,startTE:1,flex:1,startK:1,startDST:1,bench:6};
const alternate={...baseline,startWR:3,flex:2};
const expected=(settings,starters,total)=>{const slots=buildRosterSlots(settings),view=roster.assignSlots({slots,draftedEntries:[]});if(view.starters.length!==starters||view.bench.length!==6||view.allRows.length!==total)process.exit(1);return slots};
for(const mode of ['practice','live']){
  const a=expected(baseline,9,15),b=expected(alternate,11,17),c=expected(baseline,9,15);
  for(const slot of ['WR1','WR2','FLEX1'])if(!a.includes(slot))process.exit(2);
  if(a.includes('WR3')||a.includes('FLEX2'))process.exit(3);
  for(const slot of ['WR1','WR2','WR3','FLEX1','FLEX2'])if(!b.includes(slot))process.exit(4);
  if(JSON.stringify(a)!==JSON.stringify(c))process.exit(5);
}
const slots=buildRosterSlots(alternate),positions=['QB','RB','RB','WR','WR','WR','TE','RB','WR','K','DST','QB','RB','WR','TE','RB','WR','QB','RB'];
const draftedEntries=positions.map((pos,index)=>({id:index+1,draftOrder:index+1,player:{id:index+1,name:`P${index+1}`,pos}}));
const filled=roster.assignSlots({slots,draftedEntries});
if(filled.starters.length!==11||filled.bench.length!==6||filled.overflow.length!==2||filled.allRows.filter(row=>row.player).length!==19)process.exit(6);
""")

    def test_odd_snake_math_and_ten_team_regression(self):
        self.run_node(r"""
const d=require('./js/draft-math-v1.js');
for(const n of [9,11,10]){
  const r1=Array.from({length:n},(_,i)=>d.teamForPick(i+1,n));
  const r2=Array.from({length:n},(_,i)=>d.teamForPick(n+i+1,n));
  const r3=Array.from({length:n},(_,i)=>d.teamForPick(2*n+i+1,n));
  if(r1.join(',')!==Array.from({length:n},(_,i)=>i+1).join(','))process.exit(1);
  if(r2.join(',')!==Array.from({length:n},(_,i)=>n-i).join(','))process.exit(2);
  if(r3.join(',')!==r1.join(','))process.exit(3);
  if(d.pickInfo({pick:n,size:n,userSlot:n,totalRounds:17}).followingUserPick!==n+1)process.exit(4);
  if(d.pickInfo({pick:1,size:n,userSlot:1,totalRounds:17}).followingUserPick!==2*n)process.exit(5);
  const final=n*17;if(d.teamForPick(final,n)!==n||d.pickInfo({pick:final,size:n,userSlot:n,totalRounds:17}).nextUserPick!==final)process.exit(6);
  if(d.remainingUserPicks({currentPick:final+1,size:n,userSlot:n,totalRounds:17})!==0)process.exit(7);
}
if(!d.SUPPORTED_SIZES.includes(9)||!d.SUPPORTED_SIZES.includes(11))process.exit(8);
""")
        self.assertIn('<option value="9">9 teams</option>', self.html)
        self.assertIn('<option value="11">11 teams</option>', self.html)

    def test_active_configuration_reaches_strategy_completion_and_grader(self):
        self.run_node(r"""
const strategy=require('./js/draft-strategy-engine-v1.js'),roster=require('./js/roster-view-v1.js'),completion=require('./js/roster-completion-constraint-v1.js'),grading=require('./js/draft-grading-engine-v1.js'),math=require('./js/draft-math-v1.js');
const p=(id,pos,rank=20)=>({id,name:`P${id}`,pos,overall:rank,overallTier:'B',positionRank:id});
const base={teams:10,scoring:'half',startQB:1,startRB:2,startWR:2,startTE:1,flex:1,startK:1,startDST:1,bench:6};
const alt={...base,startWR:3,flex:2};
const core=[p(1,'QB'),p(2,'RB'),p(3,'RB'),p(4,'WR'),p(5,'WR'),p(6,'TE'),p(7,'WR')];
const baseEquity=strategy.starterEquity({roster:core,config:base}),altEquity=strategy.starterEquity({roster:core,config:alt});
if(baseEquity.slots.WR.length!==2||baseEquity.slots.FLEX.length!==1||altEquity.slots.WR.length!==3||altEquity.slots.FLEX.length!==2||altEquity.weakSlots<=baseEquity.weakSlots)process.exit(1);
const wr=p(8,'WR',40),baseCandidate=strategy.evaluateCandidate({player:wr,baseScore:80,pick:35,round:4,roster:core,candidates:[wr],config:base}),altCandidate=strategy.evaluateCandidate({player:wr,baseScore:80,pick:35,round:4,roster:core,candidates:[wr],config:alt});
if(altCandidate.starterEquity.impact<=baseCandidate.starterEquity.impact)process.exit(2);
const rbRoster=[p(8,'RB',10)],rbPool=[p(9,'RB',15),p(10,'RB',65)];
if(strategy.recoveryCost({position:'RB',candidates:rbPool,picksUntil:4,roster:rbRoster,config:{...base,startRB:1}}).unresolved)process.exit(3);
if(!strategy.recoveryCost({position:'RB',candidates:rbPool,picksUntil:4,roster:rbRoster,config:base}).unresolved)process.exit(4);
const slots=settings=>['QB',...Array.from({length:settings.startRB},(_,i)=>`RB${i+1}`),...Array.from({length:settings.startWR},(_,i)=>`WR${i+1}`),'TE',...Array.from({length:settings.flex},(_,i)=>`FLEX${i+1}`),'K','DEF',...Array.from({length:settings.bench},(_,i)=>`BENCH${i+1}`)];
for(const settings of [base,alt]){const assigned=roster.assignSlots({slots:slots(settings),draftedEntries:[]}),state=completion.buildState({rosterState:assigned,rosterSlots:slots(settings),availablePlayers:[p(20,'QB'),p(21,'RB'),p(22,'WR'),p(23,'TE'),p(24,'K'),p(25,'DST')],currentPick:1,totalPicks:settings.teams*assigned.starters.length,userTeam:1,teamForPick:pick=>math.teamForPick(pick,settings.teams)});if(state.requiredSlotsRemaining!==assigned.starters.length||state.userPicksRemaining!==assigned.starters.length||state.mode!=='HARD')process.exit(5)}
const normalized=grading.normalizedSettings(alt);if(normalized.startWR!==3||normalized.flex!==2||normalized.teams!==10)process.exit(6);
const lineupPlayers=[p(30,'QB'),p(31,'RB'),p(32,'RB'),p(33,'WR'),p(34,'WR'),p(35,'WR'),p(36,'TE'),p(37,'RB'),p(38,'WR'),p(39,'K'),p(40,'DST')];
if(grading.assignLineup(lineupPlayers,normalized).starters.length!==11)process.exit(7);
const report=grading.evaluateDraft({settings:alt,teams:[{teamId:1,players:[...lineupPlayers,...Array.from({length:6},(_,i)=>p(50+i,i%2?'RB':'WR',80+i))]}]});
if(report.settings.startWR!==3||report.settings.flex!==2||report.teams.length!==1)process.exit(8);
""")
        scoring = self.app.split('function scoreComponents', 1)[1].split('function pickInstruction', 1)[0]
        self.assertIn('config:leagueContext', self.app)
        self.assertNotIn('startWR:2', scoring)

    def test_command_center_needs_follow_config_without_default_regression(self):
        self.run_node(r"""
global.window={};require('./js/command-center-v1.js');const c=window.DraftCommandCenterV1,counts={QB:1,RB:2,WR:2,TE:1,K:1,DST:1};
const base=c.calculatePositionNeeds(counts,15,4,{startQB:1,startRB:2,startWR:2,startTE:1,startK:1,startDST:1});
const alt=c.calculatePositionNeeds(counts,17,4,{startQB:1,startRB:2,startWR:3,startTE:1,startK:1,startDST:1});
const defaults=c.calculatePositionNeeds({...counts,WR:3},17,4);
if(base.WR!==0||alt.WR===0||defaults.WR!==0)process.exit(1);
""")

    def test_sharingan_manager_needs_follow_config(self):
        self.run_node(r"""
global.window=global;require('./js/sharingan-vision-v1.js');const s=SharinganVisionV1,counts={QB:1,RB:2,WR:2,TE:1};
if(s.assessUserNeed({position:'WR',counts,settings:{startWR:2}}).starterNeed)process.exit(1);
if(!s.assessUserNeed({position:'WR',counts,settings:{startWR:3}}).starterNeed)process.exit(2);
const teams=[{counts},{counts:{...counts,WR:3}}];
if(s.assessTeamNeeds({position:'WR',teamsBeforeNext:teams,settings:{startWR:2}}).starterNeeds!==0)process.exit(3);
if(s.assessTeamNeeds({position:'WR',teamsBeforeNext:teams,settings:{startWR:3}}).starterNeeds!==1)process.exit(4);
if(s.rosterConstruction(counts,{startQB:1,startRB:2,startWR:2,startTE:1}).unfilledStarterPositions.length)process.exit(5);
""")


class BdgeSnapshotTests(unittest.TestCase):
    def test_snapshot_contract_and_identity_reconciliation(self):
        snapshot = json.loads((ROOT / 'data' / 'rankings' / 'bdge_top_50_2026-08-12.json').read_text(encoding='utf-8'))
        players = json.loads((ROOT / 'data' / 'players.json').read_text(encoding='utf-8'))
        by_id = {str(player['id']): player for player in players}
        records = snapshot['records']
        self.assertEqual(len(records), 50)
        self.assertEqual(sorted(row['overallRank'] for row in records), list(range(1, 51)))
        self.assertEqual(len({str(row['playerId']) for row in records}), 50)
        self.assertEqual(snapshot['source'], 'BDGE')
        self.assertEqual(snapshot['snapshotDate'], '2026-08-12')
        self.assertEqual(snapshot['scoringFormat'], 'full-PPR')
        self.assertEqual(snapshot['quarterbackFormat'], '1QB')
        self.assertEqual(snapshot['activationStatus'], 'data-only-not-active')
        expected_tier_counts = {1: 3, 2: 2, 3: 2, 4: 3, 5: 9, 6: 9, 7: 10, 8: 8, 9: 4}
        self.assertEqual({tier: sum(row['tier'] == tier for row in records) for tier in range(1, 10)}, expected_tier_counts)
        for row in records:
            self.assertIn(str(row['playerId']), by_id)
            self.assertEqual(row['playerName'], by_id[str(row['playerId'])]['name'])

    def test_snapshot_is_firewalled_from_active_fantasyland_data(self):
        active = json.loads((ROOT / 'data' / 'rankings' / 'ACTIVE_SNAPSHOT.json').read_text(encoding='utf-8'))
        self.assertEqual(active['sources']['Fantasyland']['activeSnapshot'], 'fantasyland_draftday_2026-09-02.normalized.json')
        self.assertEqual(active['sources']['Flock']['activeSnapshot'], 'flock_draftday_2026-09-02.normalized.json')
        for path in ('index.html', 'js/app.js', 'service-worker.js'):
            source = (ROOT / path).read_text(encoding='utf-8')
            self.assertNotIn('bdge_top_50_2026-08-12', source)


if __name__ == '__main__':
    unittest.main()
