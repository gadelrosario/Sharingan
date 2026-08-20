'use strict';

const Contract=require('../championship-equity/contract');

const TIER_ORDER=Object.freeze(['S','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O']);
const STAGE_RULES=Object.freeze({
  EARLY:Object.freeze({authority:'MINIMAL',sameTierRankGap:4,sameTierMambaGap:1,oneTierAllowed:false,oneTierRankGap:0,oneTierMambaGap:0}),
  MIDDLE:Object.freeze({authority:'MODERATE',sameTierRankGap:8,sameTierMambaGap:2,oneTierAllowed:true,oneTierRankGap:12,oneTierMambaGap:2}),
  LATE:Object.freeze({authority:'STRONGER',sameTierRankGap:12,sameTierMambaGap:3,oneTierAllowed:true,oneTierRankGap:18,oneTierMambaGap:3}),
  BENCH_BUILDING:Object.freeze({authority:'STRONGER',sameTierRankGap:18,sameTierMambaGap:3,oneTierAllowed:true,oneTierRankGap:24,oneTierMambaGap:4}),
});
const finite=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
const clean=value=>String(value??'').trim();
const tierIndex=value=>{const index=TIER_ORDER.indexOf(clean(value).toUpperCase());return index<0?null:index};
const bool=value=>value===true;

function normalizeContext(input={}){
  const league=Contract.leagueContext(input.league||input),stage=STAGE_RULES[league.draftStage]?league.draftStage:'EARLY';
  return Object.freeze({league,draftStage:stage,stageRule:STAGE_RULES[stage],currentAdpAvailable:bool(input.currentAdpAvailable),criticalStarterNeed:bool(input.criticalStarterNeed),rosterPreference:clean(input.rosterPreference||'NEUTRAL').toUpperCase(),survival:clean(input.survival||'UNKNOWN').toUpperCase(),profileId:clean(input.profileId||league.profileId)||null});
}

function normalizePlayer(input={}){
  return Object.freeze({canonicalPlayerId:clean(input.canonicalPlayerId||input.playerId||input.id),playerName:clean(input.playerName||input.name),position:clean(input.position||input.pos).toUpperCase(),expertRank:finite(input.expertRank),expertTier:clean(input.expertTier).toUpperCase()||null,mambaScore:finite(input.mambaScore),sourceValue:finite(input.sourceValue??input.finalPickScore),championshipEquityScore:finite(input.championshipEquityScore??input.shadowScore),championshipEquityClass:clean(input.championshipEquityClass||input.classification).toUpperCase(),evidenceComplete:bool(input.evidenceComplete??input.dataCompleteness?.complete),componentEvidence:Object.freeze([...(input.componentEvidence||input.components||[])]),valuableDepth:bool(input.valuableDepth),replaceableDepth:bool(input.replaceableDepth),starterImpact:finite(input.starterImpact)});
}

function optionality(player){
  if(!player.evidenceComplete||player.championshipEquityScore===null)return'INSUFFICIENT_EVIDENCE';
  if(player.valuableDepth||player.expertTier==='S'||player.expertTier==='A')return'USEFUL_DEPTH';
  if(player.championshipEquityClass==='HIGH')return'HIGH_OPTIONALITY';
  if(player.championshipEquityClass==='MODERATE')return'USEFUL_DEPTH';
  return player.replaceableDepth?'LOW_OPTIONALITY':'UNRESOLVED_ROLE_VALUE';
}

function evaluate(input={}){
  const context=normalizeContext(input.context),incumbent=normalizePlayer(input.incumbent),challenger=normalizePlayer(input.challenger),incumbentTier=tierIndex(incumbent.expertTier),challengerTier=tierIndex(challenger.expertTier),tierGap=incumbentTier===null||challengerTier===null?null:challengerTier-incumbentTier,rankGap=incumbent.expertRank===null||challenger.expertRank===null?null:challenger.expertRank-incumbent.expertRank,mambaGap=incumbent.mambaScore===null||challenger.mambaScore===null?null:incumbent.mambaScore-challenger.mambaScore,valueGap=incumbent.sourceValue===null||challenger.sourceValue===null?null:incumbent.sourceValue-challenger.sourceValue,ceEdge=incumbent.championshipEquityScore===null||challenger.championshipEquityScore===null?null:challenger.championshipEquityScore-incumbent.championshipEquityScore;
  const reasons=[];let reachBudget='PROHIBITED_REACH',simulatedAction='UNCHANGED',eligible=false,reviewEligible=false;
  const identityValid=Boolean(incumbent.canonicalPlayerId&&challenger.canonicalPlayerId&&incumbent.canonicalPlayerId!==challenger.canonicalPlayerId),metricsValid=[mambaGap,valueGap,ceEdge,tierGap,rankGap].every(value=>value!==null);
  if(!identityValid)reasons.push('IDENTITY_FAILURE');
  if(incumbentTier===null||challengerTier===null)reasons.push('MISSING_TIER');
  if(!challenger.evidenceComplete||challenger.championshipEquityScore===null)reasons.push('INCOMPLETE_CHAMPIONSHIP_EQUITY_EVIDENCE');
  if(['QB','TE'].includes(challenger.position))reasons.push('UNSUPPORTED_POSITION');
  if(!metricsValid)reasons.push('MISSING_REQUIRED_COMPARISON_INPUT');
  if(identityValid&&metricsValid&&!reasons.length){
    if(tierGap<0){reasons.push('CHALLENGER_ALREADY_STRONGER_BY_EXPERT_TIER');simulatedAction='VALUE_UPSIDE_ALIGNMENT';reachBudget='SAME_TIER_ONLY'}
    else if(tierGap===0){
      reachBudget='SAME_TIER_ONLY';
      if(rankGap<0&&valueGap<=0){simulatedAction='VALUE_UPSIDE_ALIGNMENT';reasons.push('EXPERT_VALUE_AND_UPSIDE_ALIGN')}
      else if(ceEdge>=10&&rankGap<=context.stageRule.sameTierRankGap&&mambaGap<=context.stageRule.sameTierMambaGap&&valueGap<=context.stageRule.sameTierMambaGap){eligible=true;simulatedAction=context.survival==='LIKELY_TO_SURVIVE'?'WAIT_FOR_PRICE':'TIE_BREAK_TO_CHAMPIONSHIP_EQUITY';reasons.push(simulatedAction==='WAIT_FOR_PRICE'?'SURVIVAL_SUPPORTS_WAIT':'SAME_TIER_MODEST_PRODUCTION_GAP')}
      else reasons.push('SAME_TIER_EDGE_NOT_DECISIVE');
    }else if(tierGap===1){
      if(!context.currentAdpAvailable){reachBudget='SAME_TIER_ONLY';reasons.push('CURRENT_ADP_UNAVAILABLE')}
      else if(!context.stageRule.oneTierAllowed){reasons.push('EARLY_STAGE_ONE_TIER_MOVE_PROHIBITED')}
      else if(context.criticalStarterNeed||context.league.remainingStarterCapacity>0){reasons.push('STARTER_FOUNDATION_INCOMPLETE')}
      else if(context.rosterPreference==='INCUMBENT'){reasons.push('ROSTER_CONTEXT_PREFERS_INCUMBENT')}
      else if(challenger.championshipEquityClass!=='HIGH'||ceEdge<15){reasons.push('ONE_TIER_REQUIRES_HIGH_DECISIVE_EVIDENCE')}
      else if(rankGap>context.stageRule.oneTierRankGap||mambaGap>context.stageRule.oneTierMambaGap||valueGap>context.stageRule.oneTierMambaGap){reasons.push('ONE_TIER_PRODUCTION_GAP_EXCEEDS_BUDGET')}
      else if(context.survival==='LIKELY_TO_SURVIVE'){reachBudget='WAIT_FOR_PRICE';simulatedAction='WAIT_FOR_PRICE';reasons.push('SURVIVAL_SUPPORTS_WAIT')}
      else{reviewEligible=true;reachBudget='SMALL_GAP_ALLOWED';simulatedAction='GUARDED_REVIEW';reasons.push('HIGH_OPTIONALITY_TIMING_WINDOW')}
    }else reasons.push('MULTI_TIER_MOVE_PROHIBITED');
  }
  if(incumbent.valuableDepth&&incumbent.position==='RB'&&simulatedAction==='GUARDED_REVIEW'){reviewEligible=false;reachBudget='PROHIBITED_REACH';simulatedAction='UNCHANGED';reasons.push('VALUABLE_RB_DEPTH_PRESERVED')}
  const confidence=simulatedAction==='GUARDED_REVIEW'?'LOWERED':simulatedAction==='TIE_BREAK_TO_CHAMPIONSHIP_EQUITY'?'GUARDED':'UNCHANGED';
  return Object.freeze({mode:'SIMULATED_AUTHORITY_SHADOW_ONLY',recommendationAuthority:false,productionMutation:false,profileId:context.profileId,draftStage:context.draftStage,stageAuthority:context.stageRule.authority,incumbent,challenger,comparison:Object.freeze({tierGap,rankGap,mambaGap,valueGap,championshipEquityEdge:ceEdge}),rosterContext:Object.freeze({remainingStarterCapacity:context.league.remainingStarterCapacity,criticalStarterNeed:context.criticalStarterNeed,rosterPreference:context.rosterPreference}),survival:context.survival,currentAdpAvailable:context.currentAdpAvailable,reachBudget,eligible,reviewEligible,simulatedAction,confidence,actualJoninResult:Object.freeze({canonicalPlayerId:incumbent.canonicalPlayerId,playerName:incumbent.playerName}),simulatedChampionshipEquityAwareResult:Object.freeze({canonicalPlayerId:simulatedAction==='TIE_BREAK_TO_CHAMPIONSHIP_EQUITY'?challenger.canonicalPlayerId:incumbent.canonicalPlayerId,playerName:simulatedAction==='TIE_BREAK_TO_CHAMPIONSHIP_EQUITY'?challenger.playerName:incumbent.playerName,reviewCandidate:simulatedAction==='GUARDED_REVIEW'?challenger.canonicalPlayerId:null}),negativeChampionshipEquityPenalty:0,incumbentOptionality:optionality(incumbent),challengerOptionality:optionality(challenger),reasons:Object.freeze(reasons)});
}

function summarize(fixtures=[]){
  const evaluations=fixtures.map(fixture=>Object.freeze({fixtureId:fixture.fixtureId,description:fixture.description,...evaluate(fixture)})),count=field=>evaluations.reduce((result,row)=>{const key=row[field]??'UNKNOWN';result[key]=(result[key]||0)+1;return result},{}),pathological=evaluations.filter(row=>row.simulatedAction==='GUARDED_REVIEW'&&(row.comparison.tierGap!==1||row.comparison.rankGap>STAGE_RULES[row.draftStage].oneTierRankGap));
  return Object.freeze({schemaVersion:1,milestone:'Jōnin 4.3.19',mode:'SIMULATED_AUTHORITY_SHADOW_ONLY',recommendationAuthority:false,evaluations:Object.freeze(evaluations),summary:Object.freeze({fixtures:evaluations.length,profiles:Object.freeze(count('profileId')),actions:Object.freeze(count('simulatedAction')),reachBudgets:Object.freeze(count('reachBudget')),pathologicalReachCount:pathological.length})});
}

module.exports=Object.freeze({TIER_ORDER,STAGE_RULES,tierIndex,normalizeContext,normalizePlayer,optionality,evaluate,summarize});
