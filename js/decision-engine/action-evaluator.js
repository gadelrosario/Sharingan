'use strict';
const {evidenceMap}=require('./evidence-collector');

const upper=value=>String(value??'').toUpperCase();
function read(record,...keys){let value=record?.value;for(const key of keys){if(value&&typeof value==='object'&&value[key]!==undefined)return value[key];}return value;}
function includes(value,terms){const text=upper(value);return terms.some(term=>text.includes(term));}
function result(candidate,pros,cons,unknown,flags=[]){let viability='VIABLE';if(!candidate.available)viability='BLOCKED';else if(pros.length>=2&&!cons.length)viability='STRONG';else if(!pros.length&&cons.length)viability='WEAK';else if(!pros.length&&unknown.length>=3)viability='WEAK';return Object.freeze({action:candidate.action,playerId:candidate.playerId,viability,pros:Object.freeze(pros),cons:Object.freeze(cons),unknown:Object.freeze(unknown),flags:Object.freeze(flags)});}

function evaluateAction(candidate,evidence){
  const map=evidenceMap(evidence),unknown=evidence.filter(item=>item.availability==='UNKNOWN').map(item=>item.category),pros=[],cons=[],flags=[];
  const timing=read(map.TIMING,'timingRecommendation','label'),tierRisk=read(map.TIERS,'tierDropRisk','currentTierRisk'),market=read(map.MARKET,'valueWindow','label'),risk=read(map.RISK,'severity','level'),roster=read(map.ROSTER,'needStatus','status'),psychology=read(map.PSYCHOLOGY,'runStatus','timingRecommendation'),environment=read(map.ENVIRONMENT,'status','label'),expert=map.EXPERT?.value;
  const add=(list,condition,text,flag)=>{if(condition){list.push(text);if(flag)flags.push(flag);}};
  switch(candidate.action){
    case'DRAFT_NOW':
      add(pros,includes(timing,['ACT NOW','DRAFT NOW']),'Timing evidence supports acting now.','TIMING_ACT');add(pros,includes(risk,['HIGH','CRITICAL']),'Passing carries material loss risk.','HIGH_RISK');add(cons,includes(market,['POOR','REACH']),'Current acquisition cost may be inefficient.');add(cons,includes(timing,['SAFE TO WAIT']),'Timing evidence supports patience.');break;
    case'WAIT':
      add(pros,includes(timing,['SAFE TO WAIT','WAIT']),'Current timing supports waiting.','SAFE_WAIT');add(pros,includes(tierRisk,['LOW']),'The current tier is not projected to collapse.');add(cons,includes(risk,['HIGH','CRITICAL']),'The preferred path may disappear before the next turn.');add(cons,includes(tierRisk,['HIGH','CRITICAL']),'Waiting may cost a tier.');break;
    case'PIVOT':
      add(pros,candidate.available,'A concrete alternative path is available.','PIVOT_AVAILABLE');add(pros,includes(market,['POOR'])||includes(environment,['POOR','BOTTOM']),'The current path has a material price or environment objection.');add(cons,!candidate.available,'No concrete pivot is available.');break;
    case'PROTECT_TIER':
      add(pros,includes(tierRisk,['CRITICAL','HIGH']),'The current position tier is at material risk.','TIER_AT_RISK');add(pros,includes(timing,['PROTECT THE TIER']),'Timing intelligence explicitly supports tier protection.','TIMING_PROTECT');add(cons,includes(tierRisk,['LOW']),'Tier depth does not currently require protection.');break;
    case'EXPLOIT_VALUE':
      add(pros,includes(market,['GOOD','EXCELLENT','VALUE']),'The acquisition window is favorable.','VALUE_OPEN');add(pros,Array.isArray(expert)&&expert.some(signal=>signal?.applicable===true&&['PRICE_DISCIPLINE','VALUE_WINDOW'].includes(signal.category)),'Applicable expert evidence supports the value window.');add(cons,includes(market,['POOR','REACH']),'The current price is outside the acceptable window.');break;
    case'BUILD_POSITION':
      add(pros,includes(roster,['ACTUAL_NEED','OPEN_STARTER']),'Roster construction has an unfilled positional requirement.','ROSTER_NEED');add(pros,includes(tierRisk,['HIGH','CRITICAL']),'The needed position may lose tier access.');add(cons,includes(roster,['POSITIONAL_STRENGTH','FILLED']),'The position is already structurally strong.');break;
    case'DELAY_POSITION':
      add(pros,includes(roster,['POSITIONAL_STRENGTH','FILLED']),'Roster construction permits delaying this position.','POSITION_FILLED');add(pros,includes(timing,['SAFE TO WAIT']),'The position can likely be revisited later.');add(cons,includes(tierRisk,['HIGH','CRITICAL']),'Delay may sacrifice a meaningful tier.');break;
    case'MONITOR':
      add(pros,unknown.length>=3,'Several decision inputs are unavailable.','INCOMPLETE_EVIDENCE');add(pros,includes(psychology,['STARTING','MONITOR']),'The room signal is developing rather than decisive.');add(cons,includes(tierRisk,['CRITICAL'])||includes(risk,['CRITICAL']),'Immediate risk makes passive monitoring costly.');break;
  }
  return result(candidate,pros,cons,unknown,flags);
}
function evaluateCandidates(candidates,evidence){return Object.freeze(candidates.map(candidate=>evaluateAction(candidate,evidence)));}
module.exports=Object.freeze({evaluateAction,evaluateCandidates});
