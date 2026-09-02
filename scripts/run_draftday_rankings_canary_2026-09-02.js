'use strict';

const fs=require('fs');
const path=require('path');
const {createHarness}=require('../tests/recommendation-baseline-harness.js');

const ROOT=path.resolve(__dirname,'..');
const previous=require('../data/rankings/fantasyland_draftday_2026-08-23.normalized.json');
const candidate=require('../data/rankings/fantasyland_draftday_2026-09-02.normalized.json');
const previousHarness=createHarness({unified:true});
const candidateHarness=createHarness({unified:true});
previousHarness.applyRankingSnapshot(previous.records);
candidateHarness.applyRankingSnapshot(candidate.records);

const fixtures=[
  {name:'opening-slot-1',pick:1,userSlot:1},
  {name:'opening-slot-5',pick:1,userSlot:5},
  {name:'opening-slot-10',pick:1,userSlot:10},
  {name:'middle-pick-47',pick:47,userSlot:7,userRoster:['Jahmyr Gibbs','CeeDee Lamb','Josh Allen','Trey McBride'],preserve:['Jauan Jennings','Oronde Gadsden II']},
  {name:'late-pick-107',pick:107,userSlot:7,userRoster:['Jahmyr Gibbs','James Cook','CeeDee Lamb','Puka Nacua','Josh Allen','Trey McBride','Chris Olave','DK Metcalf','David Montgomery','Jaylen Waddle'],preserve:['Jauan Jennings','Oronde Gadsden II']},
];

const run=(harness,fixture)=>{harness.configure(fixture);return harness.decisionRows(5)};
const rows=fixtures.map(fixture=>{
  const before=run(previousHarness,fixture),after=run(candidateHarness,fixture);
  return{
    name:fixture.name,
    pick:fixture.pick,
    slot:fixture.userSlot,
    previousTopFive:before.map(row=>({id:row.id,name:row.name,position:row.pos,sourceRank:row.sourceRank,score:row.finalDecisionScore})),
    candidateTopFive:after.map(row=>({id:row.id,name:row.name,position:row.pos,sourceRank:row.sourceRank,score:row.finalDecisionScore,defensible:row.integrity?.defensible!==false,hardRejected:row.priceOfAcquisition?.corridor?.hardRejected===true})),
    winnerChanged:String(before[0].id)!==String(after[0].id),
  };
});

const fullSettings={teams:10,scoring:'full',receptions:1,passTD:6,startQB:1,startRB:1,startWR:2,startTE:1,flex:2,startK:1,startDST:1,bench:6,ir:1};
const fullState=candidateHarness.configureLeagueState({settings:fullSettings,currentPick:30,userSlot:10,userRoster:['Jahmyr Gibbs','CeeDee Lamb']});
const allCandidateRows=rows.flatMap(row=>row.candidateTopFive);
const earlySpecialists=allCandidateRows.filter(row=>['K','DST'].includes(row.position));
const staleGuardNames=allCandidateRows.filter(row=>row.name==='Jauan Jennings'||row.name==='Oronde Gadsden II');
const duplicateCards=rows.reduce((count,row)=>count+row.candidateTopFive.length-new Set(row.candidateTopFive.map(item=>String(item.id))).size,0);
const hardRejected=allCandidateRows.filter(row=>row.hardRejected);
const indefensible=allCandidateRows.filter(row=>!row.defensible);
const summary={
  scenarios:fixtures.length+1,
  winnerChanges:rows.filter(row=>row.winnerChanged).length,
  earlySpecialistLeakage:earlySpecialists.length,
  JenningsOrGadsdenEarlyCards:staleGuardNames.map(row=>row.name),
  duplicateVisibleCards:duplicateCards,
  hardRejectedCards:hardRejected.length,
  indefensibleCards:indefensible.length,
  fullPprCards:fullState.topFive.length,
  fullPprUniqueCards:new Set(fullState.topFive.map(row=>String(row.id))).size,
  fullPprArtificialRb2Debt:fullState.foundationDebt?.targetRB===2,
};
const report={
  snapshotId:'2026-draftday-2026-09-02',
  generatedAt:'2026-09-02T00:00:00Z',
  previousSnapshotId:'2026-draftday-2026-08-23',
  boundedCanaries:rows,
  fullPprCanary:{topFive:fullState.topFive.map(row=>({id:row.id,name:row.name,position:row.pos})),foundationDebt:fullState.foundationDebt},
  summary,
};
const output=path.join(ROOT,'outputs/player_audit/draftday_rankings_canary_2026-09-02.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary));
if(summary.earlySpecialistLeakage||summary.JenningsOrGadsdenEarlyCards.length||summary.duplicateVisibleCards||summary.hardRejectedCards||summary.indefensibleCards||summary.fullPprCards!==5||summary.fullPprUniqueCards!==5||summary.fullPprArtificialRb2Debt)process.exit(1);
