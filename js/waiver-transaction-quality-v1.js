(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FantasyHQWaiverTransactionQualityV1=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const CLASSIFICATION=Object.freeze({STRONG_UPGRADE:'STRONG_UPGRADE',UPGRADE:'UPGRADE',MARGINAL_UPGRADE:'MARGINAL_UPGRADE',NEUTRAL:'NEUTRAL',DOWNGRADE:'DOWNGRADE',STRONG_DOWNGRADE:'STRONG_DOWNGRADE',INSUFFICIENT_EVIDENCE:'INSUFFICIENT_EVIDENCE'});
  const ARCHETYPE=Object.freeze({DIFFERENCE_MAKER:'DIFFERENCE_MAKER',PROBABLE_STARTER:'PROBABLE_STARTER',FLEX_UPGRADE:'FLEX_UPGRADE',HIGH_VALUE_STASH:'HIGH_VALUE_STASH',UPSIDE_STASH:'UPSIDE_STASH',CONTINGENCY_VALUE:'CONTINGENCY_VALUE',SPECULATIVE_WATCH:'SPECULATIVE_WATCH',REPLACEMENT_LEVEL:'REPLACEMENT_LEVEL'});
  const finite=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const upper=value=>String(value??'').trim().toUpperCase();
  const isCurrent=value=>['CURRENT','FRESH','VALIDATED','AUTHORITATIVE'].includes(upper(value));
  function classify(value){if(value===null)return CLASSIFICATION.INSUFFICIENT_EVIDENCE;if(value>=30)return CLASSIFICATION.STRONG_UPGRADE;if(value>=16)return CLASSIFICATION.UPGRADE;if(value>=7)return CLASSIFICATION.MARGINAL_UPGRADE;if(value>-7)return CLASSIFICATION.NEUTRAL;if(value>-20)return CLASSIFICATION.DOWNGRADE;return CLASSIFICATION.STRONG_DOWNGRADE;}
  function archetype(candidate,context={}){const d=candidate?.dimensions||{},score=finite(candidate?.score),role=finite(d.role),opportunity=finite(d.opportunity),upside=finite(d.upside),starter=upper(candidate?.starterPath),need=upper(candidate?.rosterNeed),persistent=context?.discovery?.persistent===true||finite(context?.discovery?.persistence)>=65;if(score!==null&&score>=86&&role>=82&&opportunity>=82)return ARCHETYPE.DIFFERENCE_MAKER;if(role>=72&&opportunity>=70&&(['CLEAR','STARTER','IMMEDIATE'].includes(starter)||need==='CRITICAL'))return ARCHETYPE.PROBABLE_STARTER;if(score!==null&&score>=68&&['HIGH','CRITICAL'].includes(need))return ARCHETYPE.FLEX_UPGRADE;if(score!==null&&score>=68&&upside>=78&&persistent)return ARCHETYPE.HIGH_VALUE_STASH;if(upside>=76&&persistent)return ARCHETYPE.UPSIDE_STASH;if(upside>=70&&upper(candidate?.injuryInsurance)!=='UNKNOWN')return ARCHETYPE.CONTINGENCY_VALUE;if(score!==null&&score>=48)return ARCHETYPE.SPECULATIVE_WATCH;return ARCHETYPE.REPLACEMENT_LEVEL;}
  function contextAdjustment(candidate,drop,context={}){
    const fit=context.teamFit||{},discovery=context.discovery||{},injury=context.injury||{},matchup=context.matchup||{};
    let roster=0,scarcity=0,optionality=0,discoveryValue=0,injuryValue=0,matchupValue=0,conflictPenalty=0;
    const need=upper(fit.needLevel||candidate?.rosterNeed),fitScore=finite(fit.score??fit.teamFitScore),starter=upper(fit.starterPath||candidate?.starterPath);
    if(need==='CRITICAL')roster+=8;else if(need==='HIGH')roster+=5;else if(need==='MODERATE')roster+=2;else if(need==='NONE')roster-=2;
    if(fitScore!==null)roster+=clamp((fitScore-50)/12,-4,4);
    if(['CLEAR','IMMEDIATE','STARTER'].includes(starter))roster+=4;else if(starter==='BLOCKED')roster-=3;
    const alternatives=finite(candidate?.competition?.comparableAlternativeCount);if(alternatives===0)scarcity+=4;else if(alternatives!==null&&alternatives>=4)scarcity-=2;
    optionality+=finite(drop?.optionalityCost)!==null?-clamp((finite(drop.optionalityCost)-50)/10,-4,4):0;
    optionality+=finite(drop?.redundancyCredit)!==null?clamp(finite(drop.redundancyCredit)/8,0,4):0;
    if(isCurrent(discovery.freshness||discovery.status)&&discovery.persistent===true)discoveryValue=clamp((finite(discovery.score)||0)/25,0,4);
    if(discovery.conflicted===true)conflictPenalty+=3;
    if(isCurrent(injury.freshness||injury.status)&&injury.opportunityCreated===true)injuryValue=clamp((finite(injury.confidence)||0)/25,0,4);
    if(injury.conflicted===true)conflictPenalty+=3;
    if(isCurrent(matchup.freshness||matchup.status)){const m=finite(matchup.score??matchup.matchupScore);if(m!==null)matchupValue=clamp((m-50)/25,-2,2);}
    return Object.freeze({roster,scarcity,optionality,discovery:discoveryValue,injury:injuryValue,matchup:matchupValue,conflictPenalty,total:roster+scarcity+optionality+discoveryValue+injuryValue+matchupValue-conflictPenalty});
  }
  function evaluate({candidate,drop,phase='DISCOVERY',context={}}={}){
    const candidateScore=finite(candidate?.score),dropCost=finite(drop?.dropCost);
    if(!candidate?.eligible||!drop||upper(drop.state)==='PROTECTED'||candidateScore===null||dropCost===null)return Object.freeze({netTransactionValue:null,classification:CLASSIFICATION.INSUFFICIENT_EVIDENCE,action:'HOLD',confidence:0,archetype:archetype(candidate,context),reason:!drop?'No acceptable drop candidate is available.':upper(drop?.state)==='PROTECTED'?'The required drop is protected.':'Transaction evidence is incomplete.',context:Object.freeze({}),valueEfficiency:null});
    const adjustments=contextAdjustment(candidate,drop,context),raw=candidateScore-dropCost+adjustments.total,net=clamp(raw,-100,100),classification=classify(net),candidateConfidence=finite(candidate.confidence),dropConfidence=finite(drop.confidence),baseConfidence=Math.min(candidateConfidence===null?0:candidateConfidence,dropConfidence===null ? .65 : dropConfidence),stale=[context.discovery,context.injury,context.matchup].filter(Boolean).some(item=>upper(item.freshness||item.status)==='STALE'),conflict=adjustments.conflictPenalty>0,confidence=clamp(baseConfidence-(stale?.12:0)-(conflict?.12:0),0,1),unresolvedRole=finite(candidate?.dimensions?.role)===null;
    let action='HOLD';if([CLASSIFICATION.STRONG_UPGRADE,CLASSIFICATION.UPGRADE].includes(classification))action=unresolvedRole||stale||conflict?'WAIT':'ACT';else if(classification===CLASSIFICATION.MARGINAL_UPGRADE)action='WAIT';
    if(upper(phase)==='DISCOVERY'&&action==='ACT'&&(classification!==CLASSIFICATION.STRONG_UPGRADE||confidence<.82))action='WAIT';
    if(candidate.action==='HOLD')action='HOLD';else if(candidate.action==='WAIT'&&action==='ACT')action='WAIT';
    const cost=finite(candidate?.dimensions?.acquisitionCost),valueEfficiency=cost===null||cost<=0?null:net/cost;
    const reason=action==='ACT'?`The add/drop package is a ${classification.toLowerCase().replaceAll('_',' ')} and clears the action threshold.`:action==='WAIT'?`The package improves the roster, but ${candidate.action==='WAIT'?'candidate evidence or timing does not yet authorize action':unresolvedRole?'the role remains unresolved':stale?'evidence is stale':conflict?'validated signals conflict':'the edge is still marginal'}.`:`The required drop and opportunity cost do not create enough net roster improvement.`;
    return Object.freeze({netTransactionValue:net,rawNetTransactionValue:raw,classification,action,confidence,archetype:archetype(candidate,context),reason,valueEfficiency,context:adjustments});
  }
  return Object.freeze({CLASSIFICATION,ARCHETYPE,classify,archetype,contextAdjustment,evaluate});
});
