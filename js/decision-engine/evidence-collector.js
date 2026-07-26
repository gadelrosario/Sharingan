'use strict';
const {EVIDENCE_CATEGORIES,normalizeEvidence}=require('./decision-contract');

function present(value,source,confidence=null,freshness='UNKNOWN'){return value===undefined||value===null?null:{value,source,confidence,freshness,availability:'AVAILABLE'};}
function collectEvidence(context={}){
  const intelligence=context.intelligence||{},psychology=context.draftPsychology||null;
  const inputs={
    MARKET:present(context.market??intelligence.market,'market-model',context.marketConfidence,context.marketFreshness),
    ENVIRONMENT:present(context.environment??intelligence.environment,'environment-model',context.environmentConfidence,context.environmentFreshness),
    PSYCHOLOGY:present(psychology,'draft-psychology',context.psychologyConfidence,context.psychologyFreshness),
    ROSTER:present(context.rosterState,'roster-state',context.rosterConfidence,'FRESH'),
    TIERS:present(context.tierState,'tier-contract',context.tierConfidence,context.tierFreshness),
    EXPERT:present(context.expertSignals,'expert-strategy-registry',context.expertConfidence,context.expertFreshness),
    CONFIDENCE:present(context.recommendationConfidence,'recommendation-engine',context.recommendationConfidence,'FRESH'),
    RISK:present(context.risk??intelligence.risk,'risk-model',context.riskConfidence,context.riskFreshness),
    TIMING:present(context.timing??psychology?.timingRecommendation,'timing-context',context.timingConfidence,context.timingFreshness),
  };
  return Object.freeze(EVIDENCE_CATEGORIES.map(category=>normalizeEvidence(category,inputs[category])));
}
function evidenceMap(evidence){return Object.freeze(Object.fromEntries(evidence.map(record=>[record.category,record])));}
module.exports=Object.freeze({collectEvidence,evidenceMap});
