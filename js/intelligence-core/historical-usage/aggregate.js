'use strict';

const Contract=require('./contract');
const SUM_FIELDS=['games','completions','passAttempts','passingYards','passingTouchdowns','interceptions','rushingAttempts','rushingYards','rushingTouchdowns','targets','receptions','receivingYards','receivingTouchdowns','receivingAirYards','routes','snaps','scrambles','designedRushes','redZoneRushingAttempts','redZoneTargets','goalLineCarries','explosiveRushes'];
const present=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value));
const sum=(records,field)=>records.reduce((total,record)=>total+(present(record.stats[field])?Number(record.stats[field]):0),0);
const observed=(records,field)=>records.filter(record=>present(record.stats[field])).length;
function trend(records,metric,{window=2}={}){
  const values=[...records].filter(record=>record.week!==null&&present(record.stats[metric])).sort((a,b)=>a.week-b.week).map(record=>({week:record.week,value:Number(record.stats[metric])}));
  if(values.length<window*2)return Object.freeze({metric,status:'INSUFFICIENT_DATA',direction:'UNKNOWN',magnitude:null,previousWindow:Object.freeze([]),recentWindow:Object.freeze([]),sampleSize:values.length});
  const previous=values.slice(-window*2,-window),recent=values.slice(-window),average=rows=>rows.reduce((total,row)=>total+row.value,0)/rows.length,change=average(recent)-average(previous),direction=Math.abs(change)<1e-9?'FLAT':change>0?'INCREASING':'DECREASING';
  return Object.freeze({metric,status:'EVIDENCE_PRESENT',direction,magnitude:change,previousWindow:Object.freeze(previous),recentWindow:Object.freeze(recent),sampleSize:values.length,provenance:Object.freeze({source:'Fantasy HQ',sourceFields:Object.freeze([metric]),formula:`mean(recent ${window}) - mean(previous ${window})`,sourceDataset:records[0].provenance.sourceDataset,snapshotDate:records[0].provenance.snapshotDate})});
}
function aggregateSeason(records=[]){
  if(!records.length)throw new TypeError('usage records are required');
  const canonicalPlayerId=records[0].canonicalPlayerId,season=records[0].season,position=records[0].position;
  if(records.some(record=>record.canonicalPlayerId!==canonicalPlayerId||record.season!==season||record.position!==position))throw new TypeError('aggregation group must contain one player, season, and position');
  const stats={};SUM_FIELDS.forEach(field=>{stats[field]=observed(records,field)?sum(records,field):null});
  const gamesObserved=new Set(records.filter(record=>record.week!==null).map(record=>record.week)).size||(stats.games??0),sample={games:gamesObserved,weeksObserved:gamesObserved,minimumSampleStatus:gamesObserved>=4?'MINIMUM_MET':'INSUFFICIENT',confidence:gamesObserved>=8?'MODERATE':gamesObserved>=4?'LOW':'INSUFFICIENT'};
  const derived=[],add=(metric,value,sourceFields,formula)=>derived.push(Contract.derivedMetric({canonicalPlayerId,position,season,metric,value,sourceFields,formula,sample,sourceDataset:records[0].provenance.sourceDataset,snapshotDate:records[0].provenance.snapshotDate}));
  if(stats.rushingAttempts!==null&&stats.receptions!==null)add('totalTouches',stats.rushingAttempts+stats.receptions,['rushingAttempts','receptions'],'rushingAttempts + receptions');
  if(gamesObserved&&stats.rushingAttempts!==null&&stats.receptions!==null)add('touchesPerGame',(stats.rushingAttempts+stats.receptions)/gamesObserved,['rushingAttempts','receptions','games'],'(rushingAttempts + receptions) / games');
  if(gamesObserved&&stats.targets!==null)add('targetsPerGame',stats.targets/gamesObserved,['targets','games'],'targets / games');
  if(stats.targets>0&&stats.receivingYards!==null)add('yardsPerTarget',stats.receivingYards/stats.targets,['receivingYards','targets'],'receivingYards / targets');
  if(stats.targets>0&&stats.receptions!==null)add('receptionsPerTarget',stats.receptions/stats.targets,['receptions','targets'],'receptions / targets');
  const routeWeeks=observed(records,'routes');
  if(stats.routes>0&&routeWeeks===records.length&&stats.targets!==null)add('tprr',stats.targets/stats.routes,['targets','routes'],'targets / routes');
  if(stats.routes>0&&routeWeeks===records.length&&stats.receivingYards!==null)add('yprr',stats.receivingYards/stats.routes,['receivingYards','routes'],'receivingYards / routes');
  if(stats.passAttempts>0){if(stats.passingYards!==null)add('yardsPerAttempt',stats.passingYards/stats.passAttempts,['passingYards','passAttempts'],'passingYards / passAttempts');if(stats.completions!==null)add('completionRate',stats.completions/stats.passAttempts,['completions','passAttempts'],'completions / passAttempts');if(stats.passingTouchdowns!==null)add('passingTouchdownRate',stats.passingTouchdowns/stats.passAttempts,['passingTouchdowns','passAttempts'],'passingTouchdowns / passAttempts');if(stats.interceptions!==null)add('interceptionRate',stats.interceptions/stats.passAttempts,['interceptions','passAttempts'],'interceptions / passAttempts')}
  const trendMetrics=position==='RB'?['rushingAttempts','targets','receptions','routes','redZoneRushingAttempts']:position==='QB'?['rushingAttempts','passingYards']:['targets','receptions','routes'];
  return Object.freeze({recordType:'HISTORICAL_USAGE_SEASON',canonicalPlayerId,position,season,stats:Object.freeze(stats),derivedMetrics:Object.freeze(derived),trends:Object.freeze(trendMetrics.map(metric=>trend(records,metric))),sample:Object.freeze(sample),backtestContext:Object.freeze({expertRank:null,marketAdp:null,finalFantasyFinish:null}),provenance:Object.freeze({source:records[0].provenance.source,sourceDataset:records[0].provenance.sourceDataset,snapshotDate:records[0].provenance.snapshotDate,providerPlayerId:records[0].providerPlayerId,rawRecords:records.length})});
}
function aggregateSnapshot(snapshot={}){const groups=new Map();for(const record of snapshot.records||[]){const key=`${record.canonicalPlayerId}|${record.season}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record)}return Object.freeze({schemaVersion:1,provider:snapshot.provider,sourceDataset:snapshot.sourceDataset,seasons:snapshot.seasons,snapshotDate:snapshot.snapshotDate,players:Object.freeze([...groups.values()].map(aggregateSeason)),identityQuality:Object.freeze({matchedPlayers:snapshot.matchedPlayers??0,unmatched:snapshot.unmatchedCount??0,ambiguous:snapshot.ambiguousCount??0,quarantined:snapshot.quarantinedCount??0,quarantineReasonCounts:Object.freeze({...snapshot.quarantineReasonCounts}),quarantineFieldReasonCounts:Object.freeze({...snapshot.quarantineFieldReasonCounts}),qualityReasonCounts:Object.freeze({...snapshot.qualityReasonCounts})})})}
module.exports=Object.freeze({SUM_FIELDS,trend,aggregateSeason,aggregateSnapshot});
