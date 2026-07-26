'use strict';
const D=require('../js/decision-engine');

function run(){
  const results=[],assert=(condition,message)=>{if(!condition)throw new Error(message);},test=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}};
  const engine=new D.UnifiedDecisionEngine(),base={generatedAt:'2026-07-25T12:00:00.000Z',stateKey:'pick-10',recommendation:{id:'fhq_nfl_1',name:'Primary'},pivot:{id:'fhq_nfl_2',name:'Pivot'},recommendationConfidence:78,market:{valueWindow:'FAIR'},environment:{status:'NEUTRAL'},draftPsychology:{runStatus:'NONE'},rosterState:{needStatus:'BALANCED'},tierState:{tierDropRisk:'LOW'},expertSignals:[],risk:{severity:'LOW'},timing:'FLEXIBLE'};

  test('all candidate actions supported',()=>assert(D.ACTIONS.length===8&&['DRAFT_NOW','WAIT','PIVOT','PROTECT_TIER','EXPLOIT_VALUE','BUILD_POSITION','DELAY_POSITION','MONITOR'].every(action=>D.ACTIONS.includes(action)),'actions missing'));
  test('all evidence categories supported',()=>assert(D.EVIDENCE_CATEGORIES.length===9,'evidence categories missing'));
  test('candidate generation covers all actions',()=>assert(D.generateCandidates(base).map(item=>item.action).join(',')===D.ACTIONS.join(','),'candidate generation incomplete'));
  test('candidate generation preserves recommendation',()=>assert(D.generateCandidates(base).find(item=>item.action==='DRAFT_NOW').playerId==='fhq_nfl_1','recommendation lost'));
  test('pivot candidate uses alternative',()=>assert(D.generateCandidates(base).find(item=>item.action==='PIVOT').playerId==='fhq_nfl_2','pivot lost'));
  test('missing pivot is explicitly unavailable',()=>assert(!D.generateCandidates({...base,pivot:null}).find(item=>item.action==='PIVOT').available,'missing pivot invented'));

  const evidence=D.collectEvidence(base);
  test('evidence collection normalizes nine categories',()=>assert(evidence.length===9&&evidence.every(item=>D.EVIDENCE_CATEGORIES.includes(item.category)),'evidence not normalized'));
  test('unknown evidence is explicit',()=>{const record=D.collectEvidence({})[0];assert(record.availability==='UNKNOWN'&&record.value===null&&record.source==='unavailable','unknown fabricated');});
  test('evidence confidence bounded',()=>assert(D.normalizeEvidence('MARKET',{value:'x',confidence:120}).confidence===100,'confidence not clamped'));
  test('unsupported evidence category rejected',()=>{let threw=false;try{D.normalizeEvidence('MAGIC',{value:1});}catch(_){threw=true;}assert(threw,'bad category accepted');});

  const evaluations=D.evaluateCandidates(D.generateCandidates(base),evidence);
  test('every action evaluated independently',()=>assert(evaluations.length===8&&new Set(evaluations.map(item=>item.action)).size===8,'evaluation missing'));
  test('evaluations expose pros and cons',()=>assert(evaluations.every(item=>Array.isArray(item.pros)&&Array.isArray(item.cons)),'arguments missing'));
  test('blocked pivot remains blocked',()=>{const context={...base,pivot:null},items=D.evaluateCandidates(D.generateCandidates(context),D.collectEvidence(context));assert(items.find(item=>item.action==='PIVOT').viability==='BLOCKED','pivot not blocked');});

  test('critical tier selects protect tier',()=>assert(engine.decide({...base,tierState:{tierDropRisk:'CRITICAL'},timing:'PROTECT THE TIER'}).action==='PROTECT_TIER','tier not protected'));
  test('excellent value selects exploit value',()=>assert(engine.decide({...base,market:{valueWindow:'EXCELLENT'}}).action==='EXPLOIT_VALUE','value not exploited'));
  test('act timing selects draft now',()=>assert(engine.decide({...base,timing:'ACT NOW'}).action==='DRAFT_NOW','act timing ignored'));
  test('high risk selects draft now',()=>assert(engine.decide({...base,risk:{severity:'HIGH'}}).action==='DRAFT_NOW','risk ignored'));
  test('safe timing selects wait',()=>assert(engine.decide({...base,timing:'SAFE TO WAIT'}).action==='WAIT','safe wait ignored'));
  test('material objection selects pivot',()=>assert(engine.decide({...base,market:{valueWindow:'POOR'},environment:{status:'BOTTOM_TIER'}}).action==='PIVOT','pivot not selected'));
  test('actual roster need selects build position',()=>assert(engine.decide({...base,rosterState:{needStatus:'ACTUAL_NEED'}}).action==='BUILD_POSITION','roster need ignored'));
  test('filled position selects delay position',()=>assert(engine.decide({...base,rosterState:{needStatus:'POSITIONAL_STRENGTH'}}).action==='DELAY_POSITION','delay ignored'));
  test('insufficient evidence selects monitor',()=>assert(engine.decide({generatedAt:base.generatedAt,recommendation:base.recommendation}).action==='MONITOR','unknown state fabricated action'));
  test('strategic precedence is explicit not weighted voting',()=>assert(new D.BestPathEvaluator().select(evaluations,evidence).method==='DETERMINISTIC_STRATEGIC_PRECEDENCE','selection method changed'));
  test('tier protection precedes excellent value',()=>assert(engine.decide({...base,tierState:{tierDropRisk:'CRITICAL'},market:{valueWindow:'EXCELLENT'}}).action==='PROTECT_TIER','precedence unstable'));

  const decision=engine.decide({...base,timing:'SAFE TO WAIT'});
  test('decision contract is shadow status',()=>assert(decision.status==='SHADOW','not shadow'));
  test('decision contains concise explanation',()=>assert(decision.primaryReason&&Array.isArray(decision.supportingReasons)&&Array.isArray(decision.counterArguments),'explanation missing'));
  test('decision contains evidence summary',()=>assert(decision.evidence.length===9&&decision.evidence.every(item=>!Object.hasOwn(item,'value')),'raw evidence leaked'));
  test('decision lists unknown information',()=>assert(engine.decide({generatedAt:base.generatedAt,recommendation:base.recommendation}).unknownInformation.length===9,'unknown list incomplete'));
  test('decision does not expose reasoning trace',()=>assert(!Object.hasOwn(decision,'chainOfThought')&&!Object.hasOwn(decision,'reasoningTrace'),'internal reasoning exposed'));
  test('identical inputs produce identical decision',()=>assert(JSON.stringify(engine.decide(base))===JSON.stringify(engine.decide(base)),'decision not deterministic'));
  test('decision ID is deterministic',()=>assert(engine.decide(base).decisionId===engine.decide(base).decisionId,'ID not deterministic'));
  test('generatedAt is caller-controlled',()=>{let threw=false;try{engine.decide({...base,generatedAt:null});}catch(_){threw=true;}assert(threw,'implicit clock allowed');});
  test('input recommendation confidence remains unchanged',()=>{const copy=JSON.parse(JSON.stringify(base));engine.decide(base);assert(base.recommendationConfidence===copy.recommendationConfidence,'confidence mutated');});

  test('shadow runner analyzes every recommendation',()=>{const captured=[],runner=new D.ShadowDecisionRunner({sink:item=>captured.push(item)}),summary=runner.run([{id:'a'},{id:'b'}],recommendation=>({...base,recommendation,generatedAt:base.generatedAt}));assert(summary.analyzedCount===2&&captured.length===2,'shadow coverage incomplete');});
  test('default shadow runner discards decisions',()=>{const summary=new D.ShadowDecisionRunner().run([{id:'a'}],recommendation=>({...base,recommendation}));assert(!Object.hasOwn(summary,'decisions')&&summary.status==='SHADOW','shadow decision retained');});
  test('shadow runner does not mutate recommendations',()=>{const recommendations=[{id:'a',rank:1},{id:'b',rank:2}],before=JSON.stringify(recommendations);new D.ShadowDecisionRunner().run(recommendations,recommendation=>({...base,recommendation}));assert(JSON.stringify(recommendations)===before,'recommendations mutated');});
  test('expert evidence applies only when explicitly applicable',()=>{const inactive=engine.decide({...base,market:{valueWindow:'FAIR'},expertSignals:[{category:'VALUE_WINDOW'}]}),applicable=engine.analyze({...base,market:{valueWindow:'VALUE'},expertSignals:[{category:'VALUE_WINDOW',applicable:true}]}).evaluations.find(item=>item.action==='EXPLOIT_VALUE');assert(inactive.action!=='EXPLOIT_VALUE'&&applicable.pros.length===2,'expert applicability bypassed');});
  test('environment unknown never fabricated',()=>assert(D.collectEvidence({...base,environment:null}).find(item=>item.category==='ENVIRONMENT').availability==='UNKNOWN','environment fabricated'));
  test('Best Path dimensions are structured',()=>assert(Object.keys(engine.analyze(base).bestPath.dimensions).length===7,'best path dimensions incomplete'));

  const failCount=results.filter(result=>!result.passed).length;
  console.log(`Unified Decision Engine: ${results.length-failCount} passed, ${failCount} failed`);
  results.filter(result=>!result.passed).forEach(result=>console.error(`FAIL: ${result.name}: ${result.error}`));
  return {results,passCount:results.length-failCount,failCount};
}

if(require.main===module){const result=run();if(result.failCount)process.exitCode=1;}
module.exports={run};
