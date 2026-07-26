'use strict';
const {clamp}=require('./decision-contract');

const PRECEDENCE=Object.freeze(['PROTECT_TIER','EXPLOIT_VALUE','DRAFT_NOW','PIVOT','BUILD_POSITION','WAIT','DELAY_POSITION','MONITOR']);
function byAction(evaluations,action){return evaluations.find(item=>item.action===action);}
function has(evaluation,flag){return evaluation?.flags.includes(flag);}
function median(values){if(!values.length)return 50;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function decisionConfidence(selected,evidence){const known=evidence.filter(item=>item.availability==='AVAILABLE'),scores=known.map(item=>item.confidence).filter(value=>value!==null),unknown=evidence.length-known.length;return clamp(median(scores)+(selected.pros.length>=2?5:0)-(selected.cons.length*8)-(unknown*3),20,95);}

class BestPathEvaluator {
  select(evaluations,evidence){
    const protect=byAction(evaluations,'PROTECT_TIER'),value=byAction(evaluations,'EXPLOIT_VALUE'),draft=byAction(evaluations,'DRAFT_NOW'),pivot=byAction(evaluations,'PIVOT'),build=byAction(evaluations,'BUILD_POSITION'),wait=byAction(evaluations,'WAIT'),delay=byAction(evaluations,'DELAY_POSITION'),monitor=byAction(evaluations,'MONITOR');
    let selected;
    if(has(protect,'TIER_AT_RISK'))selected=protect;
    else if(has(value,'VALUE_OPEN'))selected=value;
    else if(has(draft,'TIMING_ACT')||has(draft,'HIGH_RISK'))selected=draft;
    else if(pivot?.viability==='STRONG')selected=pivot;
    else if(has(build,'ROSTER_NEED'))selected=build;
    else if(has(wait,'SAFE_WAIT'))selected=wait;
    else if(has(delay,'POSITION_FILLED'))selected=delay;
    else selected=monitor;
    if(!selected||selected.viability==='BLOCKED')selected=PRECEDENCE.map(action=>byAction(evaluations,action)).find(item=>item&&item.viability!=='BLOCKED')||monitor;
    return Object.freeze({selected,confidence:decisionConfidence(selected,evidence),method:'DETERMINISTIC_STRATEGIC_PRECEDENCE',dimensions:Object.freeze({rosterConstruction:has(build,'ROSTER_NEED')?'NEED':'NEUTRAL',tierPreservation:has(protect,'TIER_AT_RISK')?'AT_RISK':'NEUTRAL',opportunityCost:selected.action==='WAIT'||selected.action==='PIVOT'?'PRESERVED':'ACCEPTED',timing:has(wait,'SAFE_WAIT')?'PATIENT':has(draft,'TIMING_ACT')?'ACT':'NEUTRAL',valueWindow:has(value,'VALUE_OPEN')?'OPEN':'UNKNOWN',environment:evidence.find(item=>item.category==='ENVIRONMENT')?.availability||'UNKNOWN',draftPsychology:evidence.find(item=>item.category==='PSYCHOLOGY')?.availability||'UNKNOWN'})});
  }
}
module.exports=Object.freeze({BestPathEvaluator,PRECEDENCE,decisionConfidence});
