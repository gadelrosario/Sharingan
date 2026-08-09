'use strict';
const engine=require('../js/jonin-decision-intelligence-v1.js');
const {createHarness}=require('./recommendation-baseline-harness.js');
const tests=[];
function test(name,fn){tests.push({name,fn})}
function assert(value,message){if(!value)throw new Error(message)}
function player(id,name,pos='RB'){return {id,name,pos,overall:50}}

test('highest final decision score orders first',()=>{
  const result=engine.choose([
    {player:player(1,'A'),finalDecisionScore:91,crossPositionBase:70,tier:'B'},
    {player:player(2,'B'),finalDecisionScore:88,crossPositionBase:70,tier:'B'},
  ]);
  assert(result.recommended[0].playerId===1,'lower final decision score led');
});
test('intentional source-value override exposes complete metadata',()=>{
  const result=engine.choose([
    {player:player(1,'Decision leader'),finalDecisionScore:91,crossPositionBase:55,tier:'C'},
    {player:player(2,'Value leader'),finalDecisionScore:88,crossPositionBase:95,tier:'S'},
  ]);
  assert(result.guardrail.applied,'guardrail not applied');
  for(const field of ['overrideReason','preOverrideRank','postOverrideRank','overrideMagnitude'])assert(result.guardrail[field]!==undefined,`missing ${field}`);
});
test('middle-round specialists are suppressed while skill value remains',()=>{
  const result=engine.specialistEconomics({position:'K',round:10,totalRounds:16,userPicksRemaining:7,missingSpecialists:2,meaningfulSkillValue:true,positionRank:1,hasReliableRank:true});
  assert(result.adjustment<=-40,'specialist suppression too weak');
});
test('mathematically forced specialist completion is unsuppressed',()=>{
  const result=engine.specialistEconomics({position:'DST',round:15,totalRounds:16,userPicksRemaining:2,missingSpecialists:2,completionForced:true,meaningfulSkillValue:true});
  assert(result.timingAdjustment===0,'forced specialist timing was suppressed');
});
test('missing specialist rankings receive conservative fallback',()=>{
  const ranked=engine.specialistEconomics({position:'K',round:14,totalRounds:16,userPicksRemaining:3,missingSpecialists:2,positionRank:1,hasReliableRank:true});
  const missing=engine.specialistEconomics({position:'K',round:14,totalRounds:16,userPicksRemaining:3,missingSpecialists:2,hasReliableRank:false});
  assert(missing.adjustment<ranked.adjustment,'missing rank was rewarded');
});
test('WR-heavy RB-thin construction raises marginal RB utility',()=>{
  const rb=engine.marginalRosterUtility({position:'RB',counts:{RB:3,WR:6},startRB:2,startWR:3,flex:2});
  const wr=engine.marginalRosterUtility({position:'WR',counts:{RB:3,WR:6},startRB:2,startWR:3,flex:2});
  assert(rb.adjustment>0&&wr.adjustment<0,'depth utility did not separate RB and WR');
});
test('elite WR value can override marginal depth preference',()=>{
  const wr=engine.marginalRosterUtility({position:'WR',counts:{RB:3,WR:6},startRB:2,startWR:3,flex:2,playerValueGap:12});
  assert(wr.adjustment===0,'elite value was blocked by a positional cap');
});
test('Brooks cannot outrank Daniels through missing-rank coercion',()=>{
  const harness=createHarness({unified:true});
  harness.configure({pick:47,preserve:['Jonathan Brooks','Jayden Daniels'],userRoster:['Jaxon Smith-Njigba','Omarion Hampton','Josh Jacobs','Malik Nabers']});
  const brooks=harness.playerState('Jonathan Brooks'),daniels=harness.playerState('Jayden Daniels'),top=harness.snapshot('pick47').topFive;
  assert(daniels.finalPickScore>brooks.finalPickScore,'Daniels no longer leads Brooks');
  assert(top.findIndex(row=>row.id===daniels.id)<top.findIndex(row=>row.id===brooks.id)||!top.some(row=>row.id===brooks.id),'Brooks displayed above Daniels');
});
test('Tyler Loop is not a middle-round default kicker',()=>{
  const harness=createHarness({unified:true});
  harness.configure({pick:94,preserve:['Tyler Loop'],userRoster:['Jaxon Smith-Njigba','Omarion Hampton','Josh Jacobs','Malik Nabers','Jayden Daniels','Mike Evans','Carnell Tate','Oronde Gadsden II']});
  const loop=harness.playerState('Tyler Loop'),top=harness.snapshot('pick94').topFive;
  assert(loop.mambaScore<50,'unranked kicker retained artificial default boost');
  assert(!top.some(row=>row.id===loop.id),'Tyler Loop appeared in middle-round top five');
});
test('WR-heavy roster surfaces RB depth without forcing every card',()=>{
  const harness=createHarness({unified:true});
  harness.configure({pick:111,userRoster:['Jayden Daniels','Omarion Hampton','Josh Jacobs','Jonathan Brooks','Jaxon Smith-Njigba','Malik Nabers','Mike Evans','Carnell Tate','Alec Pierce','Oronde Gadsden II','Matthew Golden']});
  const snapshot=harness.completionSnapshot();
  assert(snapshot.roster.RB===3&&snapshot.roster.WR===6,'fixture roster mismatch');
  assert(snapshot.cards[0].pos==='RB','RB depth did not lead');
  assert(snapshot.cards.some(card=>card.pos==='WR'),'depth logic became a hard position cap');
});

function run(){let passCount=0,failures=[];for(const item of tests){try{item.fn();passCount++}catch(error){failures.push({name:item.name,error:error.message})}}return {passCount,failCount:failures.length,failures}}
if(require.main===module){const result=run();console.log(JSON.stringify(result));if(result.failCount)process.exit(1)}
module.exports={run};
