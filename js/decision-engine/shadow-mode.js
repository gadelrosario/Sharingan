'use strict';
const {UnifiedDecisionEngine}=require('./unified-decision-engine');

class ShadowDecisionRunner {
  constructor({engine=new UnifiedDecisionEngine(),sink=()=>{}}={}){this.engine=engine;this.sink=sink;}
  run(recommendations=[],contextFactory=()=>({})){
    const recommendationIds=[];
    recommendations.forEach((recommendation,index)=>{const context=contextFactory(recommendation,index),analysis=this.engine.analyze({...context,recommendation});recommendationIds.push(recommendation.id);this.sink(analysis.decision);});
    return Object.freeze({status:'SHADOW',analyzedCount:recommendationIds.length,recommendationIds:Object.freeze(recommendationIds)});
  }
}
module.exports=Object.freeze({ShadowDecisionRunner});
