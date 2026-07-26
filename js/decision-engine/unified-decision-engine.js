'use strict';
const {collectEvidence}=require('./evidence-collector');
const {generateCandidates}=require('./candidate-actions');
const {evaluateCandidates}=require('./action-evaluator');
const {BestPathEvaluator}=require('./best-path-evaluator');
const {explain}=require('./explanation-generator');
const {createDecision}=require('./decision-contract');

class UnifiedDecisionEngine {
  constructor({bestPathEvaluator=new BestPathEvaluator()}={}){this.bestPathEvaluator=bestPathEvaluator;}
  analyze(context={}){
    if(!context.generatedAt)throw new TypeError('shadow analysis requires generatedAt');
    const evidence=collectEvidence(context),candidates=generateCandidates(context),evaluations=evaluateCandidates(candidates,evidence),bestPath=this.bestPathEvaluator.select(evaluations,evidence),explanation=explain(bestPath,evidence),selected=bestPath.selected;
    const decision=createDecision({action:selected.action,confidence:bestPath.confidence,primaryReason:explanation.primaryReason,supportingReasons:explanation.supportingReasons,counterArguments:explanation.counterArguments,evidence:explanation.evidenceSummary,unknownInformation:explanation.unknownInformation,generatedAt:context.generatedAt,stateKey:context.stateKey||'',recommendationId:context.recommendation?.id??null,selectedCandidateId:selected.playerId});
    return Object.freeze({decision,candidates,evaluations,bestPath,evidence});
  }
  decide(context={}){return this.analyze(context).decision;}
}
module.exports=Object.freeze({UnifiedDecisionEngine});
