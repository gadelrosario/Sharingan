'use strict';

const ACTIONS=Object.freeze(['DRAFT_NOW','WAIT','PIVOT','PROTECT_TIER','EXPLOIT_VALUE','BUILD_POSITION','DELAY_POSITION','MONITOR']);
const EVIDENCE_CATEGORIES=Object.freeze(['MARKET','ENVIRONMENT','PSYCHOLOGY','ROSTER','TIERS','EXPERT','CONFIDENCE','RISK','TIMING']);
const AVAILABILITY=new Set(['AVAILABLE','UNKNOWN']);
const FRESHNESS=new Set(['FRESH','AGING','STALE','UNKNOWN']);

function clamp(value,min=0,max=100){return Math.max(min,Math.min(max,Math.round(Number(value)||0)));}
function stableHash(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');}
function immutableList(value=[]){return Object.freeze(value.map(item=>typeof item==='object'&&item!==null?Object.freeze({...item}):item));}

function normalizeEvidence(category,input){
  const normalizedCategory=String(category||'').toUpperCase();
  if(!EVIDENCE_CATEGORIES.includes(normalizedCategory))throw new TypeError(`unsupported evidence category: ${category}`);
  if(input===undefined||input===null)return Object.freeze({category:normalizedCategory,value:null,confidence:null,freshness:'UNKNOWN',source:'unavailable',availability:'UNKNOWN'});
  const availability=String(input.availability||'AVAILABLE').toUpperCase(),freshness=String(input.freshness||'UNKNOWN').toUpperCase();
  if(!AVAILABILITY.has(availability))throw new TypeError('unsupported evidence availability');
  if(!FRESHNESS.has(freshness))throw new TypeError('unsupported evidence freshness');
  const confidence=input.confidence===undefined||input.confidence===null?null:clamp(input.confidence);
  return Object.freeze({category:normalizedCategory,value:input.value===undefined?input:input.value,confidence,freshness,source:String(input.source||'context'),availability});
}

function createDecision(input={}){
  const action=String(input.action||'').toUpperCase();if(!ACTIONS.includes(action))throw new TypeError('unsupported decision action');
  if(!input.generatedAt||Number.isNaN(Date.parse(input.generatedAt)))throw new TypeError('generatedAt must be an ISO timestamp');
  const recommendationId=input.recommendationId===undefined||input.recommendationId===null?null:String(input.recommendationId),decisionId=input.decisionId||`fhq_decision_${stableHash(`${recommendationId}|${action}|${input.stateKey||''}|${input.generatedAt}`)}`;
  return Object.freeze({decisionId,action,confidence:clamp(input.confidence),primaryReason:String(input.primaryReason||'Insufficient information to identify a stronger path.'),supportingReasons:immutableList(input.supportingReasons),counterArguments:immutableList(input.counterArguments),evidence:immutableList(input.evidence),unknownInformation:immutableList(input.unknownInformation),generatedAt:input.generatedAt,status:'SHADOW',recommendationId,selectedCandidateId:input.selectedCandidateId===undefined?null:input.selectedCandidateId});
}

module.exports=Object.freeze({ACTIONS,EVIDENCE_CATEGORIES,AVAILABILITY,FRESHNESS,clamp,stableHash,normalizeEvidence,createDecision});
