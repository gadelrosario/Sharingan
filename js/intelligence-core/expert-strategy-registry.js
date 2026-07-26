'use strict';
const {createExpertSignal}=require('./canonical-models');

const STRATEGY_CATEGORIES=Object.freeze(['PRICE_DISCIPLINE','VALUE_WINDOW','PRICE_FADE','OPPORTUNITY_COST','CONVICTION_TARGET','PLANT_FLAG','UPSIDE_PROFILE','OFFENSIVE_ENVIRONMENT','ENVIRONMENT_CONFIDENCE','CEILING_SUPPRESSION','FLOOR_SUPPORT','ROLE_STABILITY','PASS_CATCHING_PROTECTION','OFFENSE_IMPROVEMENT_PROBABILITY','PLATFORM_ADP_DIFFERENCE','LEAGUE_FORMAT_ADJUSTMENT']);
const CLAIM_TYPES=new Set(['directly_stated','summarized','inferred']);

function validateProvenance(signal){const p=signal.provenance;if(signal.status==='ACTIVE'&&(!signal.sourceReference||!p.originalSource||!p.transcriptIdentifier||!p.localReference||!p.dateCodified||!p.evidenceType||!CLAIM_TYPES.has(p.claimType)))throw new TypeError(`active signal ${signal.signalId} requires complete provenance`);return signal;}
function activeAt(signal,at){if(signal.status!=='ACTIVE')return false;const instant=Date.parse(at);if(signal.effectiveDate&&Date.parse(signal.effectiveDate)>instant)return false;if(signal.expirationDate&&Date.parse(signal.expirationDate)<instant)return false;return true;}

class ExpertStrategyRegistry {
  constructor(){this.signals=new Map();this.examples=[];}
  register(input){const signal=validateProvenance(createExpertSignal(input));if(this.signals.has(signal.signalId))throw new TypeError(`duplicate signal ID: ${signal.signalId}`);this.signals.set(signal.signalId,signal);return signal;}
  load(bundle){(bundle.principles||[]).forEach(signal=>this.register(signal));(bundle.examples||[]).forEach(example=>this.examples.push(Object.freeze({...example,illustrationOnly:true})));return this;}
  get(signalId){return this.signals.get(signalId)||null;}
  find({sourceId,source,category,signalType,scope,position,teamId,playerId,status,activeAt:when,activeOnly=false}={}){
    if(activeOnly&&!when)throw new TypeError('active queries require an explicit timestamp');
    const sourceFilter=(sourceId||source)?.toLowerCase(),categoryFilter=(category||signalType)?.toUpperCase().replace(/[^A-Z0-9]+/g,'_'),positionFilter=position?.toUpperCase();
    return Object.freeze([...this.signals.values()].filter(signal=>(!sourceFilter||signal.sourceId===sourceFilter)&&(!categoryFilter||signal.category===categoryFilter)&&(!scope||signal.scope===scope)&&(!positionFilter||signal.position===positionFilter)&&(!teamId||signal.teamId===teamId)&&(!playerId||signal.playerId===playerId)&&(!status||signal.status===status)&&(!(activeOnly||when)||activeAt(signal,when))));
  }
  findActive(at,filters={}){return this.find({...filters,activeAt:at,activeOnly:true});}
  sourceExamples(){return Object.freeze([...this.examples]);}
  snapshot(){return Object.freeze([...this.signals.values()]);}
}

module.exports=Object.freeze({ExpertStrategyRegistry,STRATEGY_CATEGORIES,CLAIM_TYPES,validateProvenance,activeAt});
