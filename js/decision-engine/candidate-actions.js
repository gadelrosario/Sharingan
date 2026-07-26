'use strict';
const {ACTIONS}=require('./decision-contract');

function generateCandidates({recommendation=null,pivot=null}={}){
  return Object.freeze(ACTIONS.map(action=>Object.freeze({action,playerId:action==='PIVOT'?(pivot?.id??null):(action==='MONITOR'||action==='WAIT'||action==='DELAY_POSITION'?null:(recommendation?.id??null)),available:action!=='PIVOT'||Boolean(pivot),metadata:Object.freeze({recommendationId:recommendation?.id??null,pivotId:pivot?.id??null})})));
}
module.exports=Object.freeze({generateCandidates});
