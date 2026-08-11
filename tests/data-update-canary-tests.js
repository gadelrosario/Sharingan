'use strict';
const fs=require('fs');
const {createHarness}=require('./recommendation-baseline-harness.js');
const strategy=require('../js/draft-strategy-engine-v1.js');

const candidateFile=process.argv[2],previousFile=process.argv[3]||null;
if(!candidateFile)throw new Error('snapshot path required');
const candidate=JSON.parse(fs.readFileSync(candidateFile,'utf8'));
const checks=[];
const check=(name,condition,detail={})=>checks.push({name,passed:Boolean(condition),detail});

const ids=new Set(),ranks=new Set();let contractValid=true;
for(const row of candidate.records||[]){
  if(!row.playerId||ids.has(String(row.playerId)))contractValid=false;
  ids.add(String(row.playerId));
  if(row.overallRank!=null){
    if(!Number.isInteger(row.overallRank)||row.overallRank<1||ranks.has(row.overallRank))contractValid=false;
    ranks.add(row.overallRank);
  }
}

function configuredHarness(snapshot){const h=createHarness({unified:true});h.applyRankingSnapshot(snapshot.records);return h}
const h=configuredHarness(candidate);
h.configureFresh({pick:1,slot:7});
const opening=h.snapshot('opening').topFive;
check('OPENING_ROUND',contractValid&&opening.length===5&&!opening.every(row=>row.mambaScore===99),{topFive:opening.map(row=>row.name)});

h.configure({name:'golden-pick-14',pick:14,userRoster:['Amon-Ra St. Brown'],preserve:['CeeDee Lamb','Saquon Barkley']});
const pick14=h.snapshot('golden-pick-14').topFive;
check('FOUNDATION',pick14.slice(0,3).filter(row=>['Bijan Robinson','Jahmyr Gibbs','Christian McCaffrey',"De'Von Achane",'Saquon Barkley'].includes(row.name)).length>=2,{topFive:pick14.map(row=>row.name)});

const stress=h.stressPicksAtSlot(50,7),positionCounts=stress.reduce((memo,row)=>(memo[row.pos]=(memo[row.pos]||0)+1,memo),{});
check('VALUE',stress.every(row=>row.debug?.strategy?.corridor?.hardRejected!==true),{unexplainedReaches:stress.filter(row=>row.debug?.strategy?.corridor?.hardRejected).length});
check('POSITIONAL_BALANCE',Math.max(...Object.values(positionCounts))<40,{positionCounts});
check('QB_TE_TIMING',(positionCounts.QB||0)>0&&(positionCounts.TE||0)>0,{QB:positionCounts.QB||0,TE:positionCounts.TE||0});
check('SPECIALIST',stress.every(row=>!['K','DST'].includes(row.pos)),{earlySpecialists:stress.filter(row=>['K','DST'].includes(row.pos)).length});

const injury=h.openingDiagnostic();
check('INJURY',injury.rows.every(row=>row.injury&&row.injury.status),{rows:injury.rows.length});
const complete=h.runDeterministicMock(7);
check('COMPLETION',(complete.roster.QB||0)>=1&&(complete.roster.RB||0)>=2&&(complete.roster.WR||0)>=3&&(complete.roster.TE||0)>=1&&(complete.roster.K||0)>=1&&(complete.roster.DST||0)>=1,{roster:complete.roster});

h.configureFresh({pick:1,slot:7});
const all=h.allBoard('ALL'),ranked=all.filter(row=>Number.isFinite(row.overallRank));
check('ALL_BOARD',ranked.every((row,index)=>index===0||ranked[index-1].overallRank<=row.overallRank),{rankedRows:ranked.length});

h.configure({name:'golden-pick-47',pick:47,userRoster:['Amon-Ra St. Brown','CeeDee Lamb','Chris Olave'],preserve:['Jadarian Price']});
const pick47=h.snapshot('golden-pick-47').topFive;
check('GOLDEN_4_2_5',!pick47.some(row=>row.name==='Jadarian Price'),{topFive:pick47.map(row=>row.name)});

const missing=strategy.valueCorridor({player:{id:'missing',pos:'RB',sourceRank:null},pick:20,round:2});
check('MISSING_DATA',missing.hardRejected&&missing.rank===null,{corridor:missing});

let recommendationDiff={baseline:'BOOTSTRAP_NO_PREVIOUS_SNAPSHOT',changes:[]};
if(previousFile){
  const previous=JSON.parse(fs.readFileSync(previousFile,'utf8')),oldHarness=configuredHarness(previous),newHarness=configuredHarness(candidate);
  const fixtures=[{name:'opening',pick:1,slot:7},{name:'pick-14',pick:14,slot:7},{name:'pick-27',pick:27,slot:7},{name:'pick-47',pick:47,slot:7}];
  recommendationDiff={baseline:previousFile,changes:fixtures.map(fixture=>{oldHarness.configureFresh({pick:fixture.pick,slot:fixture.slot});newHarness.configureFresh({pick:fixture.pick,slot:fixture.slot});const oldTop=oldHarness.snapshot(fixture.name).topFive[0],newTop=newHarness.snapshot(fixture.name).topFive[0];return{fixture:fixture.name,old:{id:oldTop.id,name:oldTop.name,score:oldTop.finalPickScore},new:{id:newTop.id,name:newTop.name,score:newTop.finalPickScore},recommendationChanged:String(oldTop.id)!==String(newTop.id)}})};
}

const failures=checks.filter(row=>!row.passed);
console.log(JSON.stringify({passCount:checks.length-failures.length,failCount:failures.length,checks,recommendationDiff}));
if(failures.length)process.exit(1);
