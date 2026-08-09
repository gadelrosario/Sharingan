'use strict';
const fs=require('fs');
const ranks=require('../js/specialist-rankings-v1.js');
const engine=require('../js/jonin-decision-intelligence-v1.js');
const tiers=require('../js/player-tier-contract.js');
const injuries=require('../js/injury-intelligence-v1.js');
const {createHarness}=require('./recommendation-baseline-harness.js');
const tests=[];const test=(name,fn)=>tests.push({name,fn});const assert=(value,message)=>{if(!value)throw new Error(message)};
const snapshot=JSON.parse(fs.readFileSync('data/specialist_rankings_2026-08-09.json','utf8'));
const players=JSON.parse(fs.readFileSync('data/players.json','utf8'));

test('specialist snapshot is complete, contiguous, and provenance-safe',()=>{
  assert(ranks.validate(snapshot).length===0,'snapshot contract failed');
  const copy=JSON.parse(JSON.stringify(players)),report=ranks.apply(copy,snapshot);
  assert(report.matched.length===56&&report.unmatched.length===6,'identity reconciliation count changed');
  const koo=copy.find(player=>player.name==='Younghoe Koo');
  assert(koo.fantasylandSpecialistSourceTeam===null&&koo.fantasylandSpecialistCanonicalTeam==='ATL','source/canonical team distinction lost');
});
test('specialist tiers cannot inherit elite cross-position power',()=>{
  const kicker={pos:'K',posTier:'1',overallTier:null},elite={pos:'RB',posTier:'S',overallTier:'S'};
  assert(tiers.getDecisionTier(kicker)==='F','K1 inherited a generic or elite tier');
  assert(tiers.getDecisionTier(elite)==='S','skill-player S tier changed');
  assert(engine.playerValue({player:kicker,tier:'F',mamba:99,overall:null})<engine.playerValue({player:elite,tier:'S',mamba:99,overall:1}),'position-only specialist tier equaled elite value');
});
test('specialist ranking answers which player while timing answers when',()=>{
  const common={position:'K',round:10,totalRounds:17,userPicksRemaining:8,missingSpecialists:2,meaningfulSkillValue:true,positionAvailable:20};
  const k1=engine.specialistEconomics({...common,positionRank:1,hasReliableRank:true,higherRankedRemaining:0}),k8=engine.specialistEconomics({...common,positionRank:8,hasReliableRank:true,higherRankedRemaining:7});
  assert(k1.baseSpecialistScore>k8.baseSpecialistScore,'positional rank did not select which specialist is best');
  assert(k1.timingAdjustment<0&&k8.timingAdjustment<0,'early timing suppression disappeared');
});
test('specialist run urgency is deterministic and explainable',()=>{
  const quiet=engine.specialistEconomics({position:'DST',round:15,totalRounds:17,userPicksRemaining:3,missingSpecialists:1,positionRank:9,hasReliableRank:true,higherRankedRemaining:8,recentSpecialists:0,positionAvailable:20}),run=engine.specialistEconomics({position:'DST',round:15,totalRounds:17,userPicksRemaining:3,missingSpecialists:1,positionRank:1,hasReliableRank:true,higherRankedRemaining:0,recentSpecialists:4,positionAvailable:4});
  assert(quiet.projectedSurvival==='LIKELY'&&run.projectedSurvival==='AT RISK','survival labels incorrect');
  assert(run.overrideReason&&run.overrideMagnitude===4,'run override metadata missing');
});
test('K1 and K2 outrank K8 when kicker completion is forced',()=>{
  const h=createHarness({unified:true}),roster=['Josh Allen','Christian McCaffrey','James Cook','Puka Nacua','CeeDee Lamb','Chris Olave','Brock Bowers','DK Metcalf','David Montgomery','Jaylen Waddle','Tetairoa McMillan','Jordan Addison','Dak Prescott','Tony Pollard','Seattle Seahawks D/ST','Rashid Shaheed'];
  h.configure({pick:170,preserve:['Brandon Aubrey',"Ka'imi Fairbairn",'Tyler Loop'],userRoster:roster});
  const aubrey=h.playerState('Brandon Aubrey'),fairbairn=h.playerState("Ka'imi Fairbairn"),loop=h.playerState('Tyler Loop');
  assert(aubrey.finalPickScore>fairbairn.finalPickScore&&fairbairn.finalPickScore>loop.finalPickScore,'K1 > K2 > K8 ordering failed');
});
test('DEF1 outranks DEF9 when defense completion is forced',()=>{
  const h=createHarness({unified:true}),roster=['Josh Allen','Christian McCaffrey','James Cook','Puka Nacua','CeeDee Lamb','Chris Olave','Brock Bowers','DK Metcalf','David Montgomery','Jaylen Waddle','Tetairoa McMillan','Jordan Addison','Dak Prescott','Tony Pollard','Brandon Aubrey','Rashid Shaheed'];
  h.configure({pick:170,preserve:['Seattle Seahawks D/ST','Houston Texans D/ST'],userRoster:roster});
  const top=h.snapshot('forced-dst').topFive.map(row=>row.name);
  assert(top.indexOf('Seattle Seahawks D/ST')!==-1&&top.indexOf('Seattle Seahawks D/ST')<top.indexOf('Houston Texans D/ST'),'DEF1 did not outrank DEF9');
});
test('middle-round Tyler Loop failure state contains no specialists',()=>{
  const h=createHarness({unified:true});h.configure({pick:94,preserve:['Tyler Loop'],userRoster:['Jaxon Smith-Njigba','Omarion Hampton','Josh Jacobs','Malik Nabers','Jayden Daniels','Mike Evans','Carnell Tate','Oronde Gadsden II']});
  assert(h.snapshot('loop').topFive.every(row=>!['K','DST'].includes(players.find(player=>player.id===row.id)?.pos)),'specialist entered middle-round top five');
});
test('four roster constructions change marginal utility without hard caps',()=>{
  const states=[
    {counts:{QB:1,RB:2,WR:5,TE:1},rbPositive:true},
    {counts:{QB:1,RB:3,WR:6,TE:1},rbPositive:true},
    {counts:{QB:1,RB:5,WR:3,TE:1},rbPositive:false},
    {counts:{QB:1,RB:2,WR:3,TE:1},rbPositive:true},
  ];
  states.forEach(({counts,rbPositive})=>{const rb=engine.marginalRosterUtility({position:'RB',counts,startRB:2,startWR:3,flex:2}),wr=engine.marginalRosterUtility({position:'WR',counts,startRB:2,startWR:3,flex:2});assert(rbPositive?rb.adjustment>=wr.adjustment:rb.adjustment<=wr.adjustment,'roster utility direction incorrect')});
  assert(engine.marginalRosterUtility({position:'WR',counts:{RB:2,WR:6},startRB:2,startWR:3,flex:2,playerValueGap:12}).adjustment===0,'elite value was capped');
});
test('generic speculative early player cannot beat higher final elite option silently',()=>{
  const result=engine.choose([{player:{id:1,name:'Speculative rookie',pos:'RB'},finalDecisionScore:91,crossPositionBase:70,tier:'C'},{player:{id:2,name:'Established elite',pos:'QB'},finalDecisionScore:96,crossPositionBase:82,tier:'A'}]);
  assert(result.recommended[0].playerId===2||result.guardrail.applied,'lower final score silently led');
});
test('displayed recommendation order follows final score or guardrail metadata',()=>{
  const h=createHarness({unified:true});h.configure({pick:47,preserve:['Jonathan Brooks','Jayden Daniels'],userRoster:['Jaxon Smith-Njigba','Omarion Hampton','Josh Jacobs','Malik Nabers']});
  const scores=h.snapshot('order').topFive.map(row=>row.finalPickScore);
  assert(scores.every((score,index)=>index===0||scores[index-1]>=score),'display order diverged from final score');
});
test('unknown injury information is not verified healthy',()=>{
  const football=injuries.footballAvailability({},'2026-08-09T12:00:00Z');
  assert(football.status==='UNKNOWN'&&football.available===null,'UNKNOWN became healthy');
});
test('stale injury information cannot present as current',()=>{
  const record={playerId:'1',status:'QUESTIONABLE',lastUpdated:'2026-08-01T00:00:00Z',sources:[{provider:'NFL',reliability:'official'}]};
  assert(injuries.freshness(record,'2026-08-09T12:00:00Z').status==='STALE','stale injury became current');
});
test('injury penalty and portfolio risk are monotonic',()=>{
  const record={status:'OUT',lastUpdated:'2026-08-09T00:00:00Z',sources:[{provider:'NFL',reliability:'official'}]},clean=injuries.decisionAdjustment({record,now:'2026-08-09T12:00:00Z',round:4,injuredPortfolio:0}),loaded=injuries.decisionAdjustment({record,now:'2026-08-09T12:00:00Z',round:4,injuredPortfolio:3});
  assert(clean.adjustment<0&&loaded.adjustment<clean.adjustment,'repeated injury exposure did not cost more');
});

function run(){let passCount=0,failures=[];for(const item of tests){try{item.fn();passCount++}catch(error){failures.push({name:item.name,error:error.message})}}return{passCount,failCount:failures.length,failures}}
if(require.main===module){const result=run();console.log(JSON.stringify(result));if(result.failCount)process.exit(1)}
module.exports={run};
