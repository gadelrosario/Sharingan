(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FantasyHQFAABIntelligenceV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const AUTHORITY=Object.freeze({LIVE:'LIVE',SHADOW:'SHADOW',BLOCKED:'BLOCKED'});
  const POSTURE=Object.freeze({ALL_IN:'ALL_IN',VERY_AGGRESSIVE:'VERY_AGGRESSIVE',AGGRESSIVE:'AGGRESSIVE',MODERATE:'MODERATE',CONSERVATIVE:'CONSERVATIVE',MINIMUM:'MINIMUM',PASS:'PASS',UNKNOWN:'UNKNOWN'});
  const PHASE=Object.freeze({DISCOVERY:'DISCOVERY',OPTIMIZATION:'OPTIMIZATION',PLAYOFF_PUSH:'PLAYOFF_PUSH',WIN_OR_GO_HOME:'WIN_OR_GO_HOME'});
  const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
  const upper=value=>String(value||'').trim().toUpperCase().replace(/[ -]+/g,'_');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const frozen=value=>Object.freeze(value);
  const isLegalDrop=drop=>Boolean(drop&&['DROPPABLE','PRIORITY_DROP','RELUCTANT_DROP'].includes(upper(drop.state)));
  const signalValue=value=>{const normalized=upper(value);return['ELITE','VERY_HIGH','VERY_STRONG_SIGNAL'].includes(normalized)?4:['HIGH','STRONG','STRONG_SIGNAL','PERSISTENT','INJURY_OPPORTUNITY_STRONG'].includes(normalized)?3:['MEDIUM','MODERATE','DEVELOPING_SIGNAL'].includes(normalized)?2:['LOW','LIMITED','UNCONFIRMED'].includes(normalized)?1:0};
  const needValue=value=>{const normalized=upper(value);return normalized==='CRITICAL'?4:normalized==='HIGH'?3:normalized==='MEDIUM'?2:normalized==='LOW'?1:0};
  const fitValue=value=>{const normalized=upper(value);return normalized==='STRONG_FIT'||normalized==='STRONG'?2:normalized==='GOOD_FIT'?1:normalized==='POOR_FIT'||normalized==='POOR'||normalized==='REDUNDANT'?-2:0};
  function normalizeBudget(budget){
    const startingBudget=finite(budget?.startingBudget),remainingBudget=finite(budget?.remainingBudget),minBid=finite(budget?.minBid),bidIncrement=finite(budget?.bidIncrement);
    return frozen({startingBudget,remainingBudget,minBid,bidIncrement,zeroBidAllowed:budget?.zeroBidAllowed===true,currency:budget?.currency||'FAAB',authoritative:budget?.authoritative===true,current:budget?.current===true,source:budget?.source||null,valid:startingBudget!==null&&startingBudget>=0&&remainingBudget!==null&&remainingBudget>=0&&remainingBudget<=startingBudget&&minBid!==null&&minBid>=0&&bidIncrement!==null&&bidIncrement>0});
  }
  function authorityFor(context,budget){
    const action=upper(context?.waiverDecision?.action),player=context?.waiverDecision?.player||context?.player,availabilityCurrent=context?.league?.availabilityCurrent===true,rosterCurrent=context?.league?.rosterCurrent===true;
    if(!player||!context?.waiverDecision)return frozen({authority:AUTHORITY.BLOCKED,reason:'No validated waiver opportunity is available.'});
    if((finite(context.waiverDecision?.dimensions?.sourceValue)??finite(context.waiverDecision?.score))===null)return frozen({authority:AUTHORITY.BLOCKED,reason:'Validated opportunity quality is unavailable.'});
    if(action==='HOLD')return frozen({authority:AUTHORITY.BLOCKED,reason:'Waiver Intelligence is HOLD; no bid is actionable.'});
    if(!isLegalDrop(context.waiverDecision.drop))return frozen({authority:AUTHORITY.BLOCKED,reason:'No acceptable legal drop is available.'});
    if(context?.league?.available===false)return frozen({authority:AUTHORITY.BLOCKED,reason:'The player is not currently available to claim.'});
    if(budget.valid&&(budget.remainingBudget===0||(!budget.zeroBidAllowed&&budget.remainingBudget<budget.minBid)))return frozen({authority:AUTHORITY.BLOCKED,reason:'No legal FAAB bid remains available under this league budget.'});
    if(context?.league?.demo===true||action!=='ACT'||!budget.valid||!budget.authoritative||!budget.current||!availabilityCurrent||!rosterCurrent)return frozen({authority:AUTHORITY.SHADOW,reason:context?.league?.demo===true?'Sanitized demo inputs are shadow-only and cannot authorize a production bid.':action==='WAIT'?'Waiver Intelligence is WAIT; pricing is conceptual until action is justified.':'Live Yahoo budget, waiver availability, and roster state are required for a production bid.'});
    return frozen({authority:AUTHORITY.LIVE,reason:'Current authoritative Yahoo budget, availability, roster, and legal drop are validated.'});
  }
  function pricingFactors(context){
    const decision=context.waiverDecision||{},dimensions=decision.dimensions||{},teamFit=context.teamFit||{},injury=context.injuryOpportunity||{},competition=decision.competition||context.league?.competition||{},phase=upper(context.league?.phase)||PHASE.DISCOVERY,strategy=upper(context.strategy)||'BALANCED';
    const quality=finite(dimensions.sourceValue)??finite(decision.score),need=needValue(teamFit.needLevel||decision.rosterNeed),fit=fitValue(teamFit.fit||teamFit.status),signal=Math.max(signalValue(injury.signalStrength),finite(injury.signalStrength)===null?0:clamp(Math.round(Number(injury.signalStrength)/25),0,4)),persistence=signalValue(injury.signalPersistence),scarcity=signalValue(context.league?.scarcity),replacement=signalValue(context.league?.replacementQuality),competitionPressure=competition.status==='OBSERVED'?clamp((finite(competition.starterNeedCount)||0)+(finite(competition.depthDemandCount)||0)*.35,0,4):0;
    const shortTerm=upper(injury.injuryOpportunity)==='SHORT_TERM',restOfSeason=upper(injury.injuryOpportunity)==='REST_OF_SEASON',dropCost=finite(decision.drop?.dropCost),dropState=upper(decision.drop?.state),sharingan=Boolean(context.signals?.sharinganPick),chidori=Boolean(context.signals?.chidori),netTransactionValue=finite(decision.transaction?.netTransactionValue),transactionClass=upper(decision.transaction?.classification),archetype=upper(decision.transaction?.archetype);
    let score=quality===null?0:(quality>=85?6:quality>=72?5:quality>=60?4:quality>=48?3:2);
    score+=need+fit+signal+persistence*.5+scarcity*.75+competitionPressure*.6;
    score+=replacement>=3?-.75:replacement===2?0:.5;
    if(shortTerm)score-=1.5;if(restOfSeason)score+=1.5;
    if(dropCost!==null)score-=clamp(dropCost/30,0,2.5);
    if(dropState==='RELUCTANT_DROP')score-=1.5;
    if(phase===PHASE.DISCOVERY)score-=1.5;if(phase===PHASE.PLAYOFF_PUSH)score+=1;if(phase===PHASE.WIN_OR_GO_HOME)score+=2;
    if(strategy==='VALUE')score-=1;if(strategy==='AGGRESSIVE')score+=1;
    if(sharingan)score+=.75;if(chidori)score+=1;
    if(netTransactionValue!==null)score+=clamp(netTransactionValue/12,-3,4);
    if(archetype==='DIFFERENCE_MAKER')score+=1.5;else if(archetype==='PROBABLE_STARTER'||archetype==='FLEX_UPGRADE')score+=.75;else if(archetype==='SPECULATIVE_WATCH'||archetype==='REPLACEMENT_LEVEL')score-=1;
    return frozen({score,quality,need,fit,signal,persistence,scarcity,replacement,competitionPressure,shortTerm,restOfSeason,dropCost,dropState,phase,strategy,sharingan,chidori,netTransactionValue,transactionClass,archetype});
  }
  function postureFor(context,factors,authority){
    if(authority===AUTHORITY.BLOCKED)return POSTURE.PASS;
    const rareAllIn=authority===AUTHORITY.LIVE&&factors.chidori&&factors.signal>=4&&factors.persistence>=3&&factors.need>=3&&factors.scarcity>=3&&factors.restOfSeason&&factors.phase===PHASE.WIN_OR_GO_HOME&&factors.dropCost!==null&&factors.dropCost<=20;
    if(rareAllIn)return POSTURE.ALL_IN;
    if(factors.score>=17)return POSTURE.VERY_AGGRESSIVE;
    if(factors.score>=13)return POSTURE.AGGRESSIVE;
    if(factors.score>=9)return POSTURE.MODERATE;
    if(factors.score>=6)return POSTURE.CONSERVATIVE;
    if(factors.score>=3)return POSTURE.MINIMUM;
    return upper(context.waiverDecision?.action)==='WAIT'?POSTURE.UNKNOWN:POSTURE.PASS;
  }
  const PERCENT_RANGES=Object.freeze({ALL_IN:[60,80,100],VERY_AGGRESSIVE:[30,38,48],AGGRESSIVE:[18,23,30],MODERATE:[9,13,17],CONSERVATIVE:[4,6,9],MINIMUM:[0,2,4],PASS:[0,0,0],UNKNOWN:[null,null,null]});
  function roundBid(value,increment,direction){if(value===null)return null;const ratio=value/increment;return (direction==='down'?Math.floor(ratio):direction==='up'?Math.ceil(ratio):Math.round(ratio))*increment;}
  function bidRange(posture,authority,budget){
    const perc=PERCENT_RANGES[posture]||PERCENT_RANGES.UNKNOWN,budgetPercentRange=frozen({min:perc[0],target:perc[1],max:perc[2],basis:'REMAINING_BUDGET'});
    if(authority!==AUTHORITY.LIVE||perc[0]===null)return frozen({budgetPercentRange,bidRange:frozen({min:null,target:null,max:null,currency:budget.currency,unit:budget.bidIncrement})});
    const raw=perc.map(value=>budget.remainingBudget*value/100),floor=posture==='PASS'?0:budget.zeroBidAllowed?0:budget.minBid;
    let min=clamp(roundBid(raw[0],budget.bidIncrement,'down'),floor,budget.remainingBudget),target=clamp(roundBid(raw[1],budget.bidIncrement),floor,budget.remainingBudget),max=clamp(roundBid(raw[2],budget.bidIncrement,'up'),floor,budget.remainingBudget);
    if(posture==='MINIMUM'&&!budget.zeroBidAllowed)min=Math.max(min,budget.minBid);
    target=Math.max(min,target);max=Math.max(target,max);
    return frozen({budgetPercentRange,bidRange:frozen({min,target,max,currency:budget.currency,unit:budget.bidIncrement})});
  }
  function evaluate(context={}){
    const decision=context.waiverDecision||{},player=decision.player||context.player||{},budget=normalizeBudget(context.budget),authorityState=authorityFor(context,budget),factors=pricingFactors(context),posture=postureFor(context,factors,authorityState.authority),ranges=bidRange(posture,authorityState.authority,budget),injury=context.injuryOpportunity||{},teamFit=context.teamFit||{},competition=decision.competition||context.league?.competition||{};
    const known=[factors.quality,teamFit.needLevel||decision.rosterNeed,injury.signalStrength,injury.signalPersistence,context.league?.scarcity,context.league?.replacementQuality,competition.status].filter(value=>value!==null&&value!==undefined&&value!=='').length,coverage=Math.round(known/7*100),freshness=injury.freshness||context.league?.freshness||'UNKNOWN';
    const mainReason=authorityState.authority===AUTHORITY.BLOCKED?authorityState.reason:factors.netTransactionValue!==null?`The ${String(factors.transactionClass||'transaction').toLowerCase().replaceAll('_',' ')} add/drop package sets the spending ceiling.`:factors.restOfSeason?'A durable role change and roster fit support paying above an ordinary claim.':factors.need>=3?'The validated move addresses a major roster need.':factors.signal>=3?'Current opportunity evidence supports a stronger claim.':'The opportunity is useful, but future budget flexibility still matters.';
    const mainRisk=factors.shortTerm?'The opportunity may disappear when the displaced player returns.':freshness==='STALE'?'Some supporting evidence is stale.':authorityState.authority!==AUTHORITY.LIVE?authorityState.reason:'Competition and future opportunity can still change before waivers process.';
    const rawConfidence=finite(decision.confidence),normalizedConfidence=rawConfidence===null?0:rawConfidence<=1?rawConfidence*100:rawConfidence,whyNotHigher=factors.phase===PHASE.DISCOVERY?'Early-season budget optionality still has material value.':factors.shortTerm?'The role may contract when the displaced player returns.':'Future waiver opportunities and uncertain competition cap the range.',whyNotLower=factors.netTransactionValue!==null&&factors.netTransactionValue>=16?'The validated net roster improvement justifies more than a token claim.':factors.need>=3?'The move addresses a meaningful roster need.':'The player retains validated opportunity value.',budgetImpact=posture===POSTURE.ALL_IN?'SEVERE':posture===POSTURE.VERY_AGGRESSIVE||posture===POSTURE.AGGRESSIVE?'MATERIAL':posture===POSTURE.MODERATE?'MANAGEABLE':'LIMITED',result={playerId:player.canonicalPlayerId||player.identity?.canonicalPlayerId||decision.canonicalPlayerId||null,playerName:player.name||null,authority:authorityState.authority,posture,bidRange:ranges.bidRange,budgetPercentRange:ranges.budgetPercentRange,remainingBudget:budget.remainingBudget,startingBudget:budget.startingBudget,opportunityQuality:factors.quality,netTransactionValue:factors.netTransactionValue,transactionClass:factors.transactionClass||null,archetype:factors.archetype||null,rosterNeed:teamFit.needLevel||decision.rosterNeed||null,teamFit:teamFit.status||teamFit.summary||null,scarcity:context.league?.scarcity??null,replacementQuality:context.league?.replacementQuality??null,competitionPressure:competition.status==='OBSERVED'?factors.competitionPressure:null,seasonPhase:factors.phase,signalStrength:injury.signalStrength??null,signalPersistence:injury.signalPersistence??null,injuryOpportunity:injury.injuryOpportunity??null,dropCost:factors.dropCost,futureFlexibility:factors.phase===PHASE.DISCOVERY?'PRESERVE':factors.phase===PHASE.WIN_OR_GO_HOME?'SPEND_NOW':'BALANCE',confidence:clamp(Math.round(normalizedConfidence*.65+coverage*.35),0,100),evidenceCoverage:coverage,freshness,mainReason,whyThisAmount:mainReason,whyNotHigher,whyNotLower,budgetImpact,alternativeValue:decision.valueEfficiency??decision.transaction?.valueEfficiency??null,mainRisk,reasoning:frozen([mainReason,`Posture is based on ${ranges.budgetPercentRange.basis.toLowerCase().replaceAll('_',' ')}.`,authorityState.reason]),riskFlags:frozen([factors.shortTerm?'SHORT_TERM_OPPORTUNITY':null,freshness==='STALE'?'STALE_EVIDENCE':null,authorityState.authority!=='LIVE'?'NO_PRODUCTION_DOLLAR_AUTHORITY':null].filter(Boolean)),provenance:frozen({waiverSource:decision.provenance?.seasonSource||context.provenance?.waiverSource||null,teamFitSource:teamFit.provenance?.rosterSource||null,injuryOpportunitySource:injury.provenance?.source||injury.source||null,budgetSource:budget.source,profileId:context.league?.profileId||null,evaluatedAt:null}),pricingFactors:factors};
    return frozen(result);
  }
  return frozen({AUTHORITY,POSTURE,PHASE,PERCENT_RANGES,normalizeBudget,authorityFor,pricingFactors,postureFor,bidRange,evaluate});
});
