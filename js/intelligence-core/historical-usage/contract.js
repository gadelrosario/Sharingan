'use strict';

const clean=value=>String(value??'').trim();
const iso=value=>{const parsed=Date.parse(value);if(!Number.isFinite(parsed))throw new TypeError('snapshotDate must be valid');return new Date(parsed).toISOString()};
const RAW_FIELDS=Object.freeze([
  'games','completions','passAttempts','passingYards','passingTouchdowns','interceptions',
  'rushingAttempts','rushingYards','rushingTouchdowns','targets','receptions','receivingYards',
  'receivingTouchdowns','receivingAirYards','targetShare','routes','snaps','scrambles',
  'designedRushes','redZoneRushingAttempts','redZoneTargets','goalLineCarries','explosiveRushes',
]);
const GUARDED_FIELDS=new Set(['scrambles','designedRushes','redZoneRushingAttempts','redZoneTargets','goalLineCarries','routes','snaps']);
function nonNegative(value,field){if(value===undefined||value===null||clean(value)==='')return null;const number=Number(value);if(!Number.isFinite(number)||number<0)throw new TypeError(`${field} must be non-negative`);return number}
function usageRecord(input={}){
  const canonicalPlayerId=clean(input.canonicalPlayerId),providerPlayerId=clean(input.providerPlayerId),source=clean(input.source),sourceDataset=clean(input.sourceDataset),position=clean(input.position).toUpperCase(),season=nonNegative(input.season,'season'),week=input.week===undefined||input.week===null||clean(input.week)===''?null:nonNegative(input.week,'week');
  if(!canonicalPlayerId||!providerPlayerId||!source||!sourceDataset)throw new TypeError('usage identity and source provenance are required');
  if(!['QB','RB','WR','TE'].includes(position))throw new TypeError('usage position must be QB, RB, WR, or TE');
  if(!Number.isInteger(season)||season<2000||!Number.isInteger(week??0))throw new TypeError('season and week must be integers');
  const fieldMetadata=input.fieldMetadata||{},stats={};let supplied=0;
  RAW_FIELDS.forEach(field=>{
    const value=nonNegative(input.stats?.[field],field);stats[field]=value;
    if(value===null)return;
    const metadata=fieldMetadata[field];
    if(GUARDED_FIELDS.has(field)&&(!metadata||!['RAW','DERIVED'].includes(clean(metadata.kind).toUpperCase())))throw new TypeError(`${field} requires explicit field provenance`);
    supplied++;
  });
  if(!supplied)throw new TypeError('usage record contains no supported statistics');
  const normalizedMetadata={};
  Object.entries(fieldMetadata).forEach(([field,metadata])=>{if(stats[field]!==null)normalizedMetadata[field]=Object.freeze({kind:clean(metadata.kind).toUpperCase(),sourceField:clean(metadata.sourceField)||null,sourceFields:Object.freeze([...(metadata.sourceFields||[])]),formula:clean(metadata.formula)||null})});
  RAW_FIELDS.forEach(field=>{if(stats[field]!==null&&!normalizedMetadata[field])normalizedMetadata[field]=Object.freeze({kind:'RAW',sourceField:field,sourceFields:Object.freeze([]),formula:null})});
  return Object.freeze({recordType:'HISTORICAL_USAGE',canonicalPlayerId,providerPlayerId,position,season,week,aggregationLevel:clean(input.aggregationLevel||'WEEK').toUpperCase(),metricBasis:'HISTORICAL',stats:Object.freeze(stats),fieldMetadata:Object.freeze(normalizedMetadata),sample:Object.freeze({games:nonNegative(input.sample?.games,'sample.games')??(week===null?null:1),weeksObserved:nonNegative(input.sample?.weeksObserved,'sample.weeksObserved')??(week===null?null:1),minimumSampleStatus:clean(input.sample?.minimumSampleStatus||'UNASSESSED').toUpperCase(),confidence:clean(input.sample?.confidence||'UNKNOWN').toUpperCase()}),provenance:Object.freeze({source,sourceDataset,snapshotDate:iso(input.snapshotDate),season,week,providerPlayerId,canonicalPlayerId,matchStatus:clean(input.matchStatus||'MATCHED').toUpperCase(),matchConfidence:clean(input.matchConfidence||'UNKNOWN').toUpperCase(),identityMethod:clean(input.identityMethod)||null})});
}
function derivedMetric({canonicalPlayerId,position,season,metric,value,sourceFields,formula,sample,sourceDataset,snapshotDate}){
  return Object.freeze({recordType:'DERIVED_USAGE_METRIC',canonicalPlayerId:String(canonicalPlayerId),position,season,metric,value,rawOrDerived:'DERIVED',sourceFields:Object.freeze([...sourceFields]),formula,sample:Object.freeze({...sample}),provenance:Object.freeze({source:'Fantasy HQ',sourceDataset,snapshotDate:iso(snapshotDate),basis:'NFLVERSE_DERIVED'})});
}
module.exports=Object.freeze({RAW_FIELDS,GUARDED_FIELDS,usageRecord,derivedMetric});
