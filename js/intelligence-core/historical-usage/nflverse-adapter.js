'use strict';

const Contract=require('./contract');
const ExistingIdentity=require('../../sleeper-injury-adapter-v1.js');
const DEFAULT_SEASONS=Object.freeze([2023,2024,2025]);
const SOURCE='nflverse';
const SOURCE_DATASET='stats_player_week';
const clean=value=>String(value??'').trim();
const FIELD_MAP=Object.freeze({
  games:'games',completions:'completions',attempts:'passAttempts',passing_yards:'passingYards',passing_tds:'passingTouchdowns',passing_interceptions:'interceptions',
  carries:'rushingAttempts',rushing_yards:'rushingYards',rushing_tds:'rushingTouchdowns',targets:'targets',receptions:'receptions',receiving_yards:'receivingYards',receiving_tds:'receivingTouchdowns',receiving_air_yards:'receivingAirYards',target_share:'targetShare',routes:'routes',snaps:'snaps',scrambles:'scrambles',designed_rushes:'designedRushes',red_zone_rushing_attempts:'redZoneRushingAttempts',red_zone_targets:'redZoneTargets',goal_line_carries:'goalLineCarries',explosive_rushes:'explosiveRushes',
});
const providerId=player=>clean(player.externalIds?.gsis||player.externalIds?.nflverse||player.gsisId||player.nflverseId||player.nflId);
function buildIdentityIndex(players=[]){
  const map=new Map(),duplicates=new Set();players.forEach(player=>{const id=providerId(player);if(!id)return;if(map.has(id))duplicates.add(id);else map.set(id,player)});duplicates.forEach(id=>map.delete(id));return{map,duplicates};
}
function buildVerifiedFallback(players=[]){
  const byIdentity=new Map();
  players.forEach(player=>{const name=ExistingIdentity.normalizeName(player.name),position=ExistingIdentity.normalizePosition(player.pos||player.position),team=clean(player.team);if(!name||!position||!team)return;const key=`${name}|${position}|${team}`;if(!byIdentity.has(key))byIdentity.set(key,[]);byIdentity.get(key).push(player)});
  return row=>{const key=`${ExistingIdentity.normalizeName(row.player_display_name||row.player_name)}|${ExistingIdentity.normalizePosition(row.position)}|${clean(row.team)}`,candidates=byIdentity.get(key)||[];return candidates.length===1?{status:'MATCHED',player:candidates[0],method:'exact-normalized-name-position-team',confidence:'MEDIUM'}:candidates.length>1?{status:'AMBIGUOUS'}:{status:'UNMATCHED'}};
}
function freshness(snapshot,now=new Date().toISOString(),maxAgeDays=120){const captured=Date.parse(snapshot?.snapshotDate),current=Date.parse(now);if(!Number.isFinite(captured)||!Number.isFinite(current))return Object.freeze({status:'UNAVAILABLE',ageDays:null});const ageDays=(current-captured)/(24*60*60*1000);return Object.freeze({status:ageDays>=0&&ageDays<=maxAgeDays?'CURRENT':'STALE',ageDays})}
function translateStats(row){const stats={},metadata={};Object.entries(FIELD_MAP).forEach(([sourceField,target])=>{if(row[sourceField]===undefined||row[sourceField]===null||clean(row[sourceField])==='')return;stats[target]=row[sourceField];const explicit=row.fieldMetadata?.[sourceField];if(explicit)metadata[target]={...explicit,sourceField};else if(!Contract.GUARDED_FIELDS.has(target))metadata[target]={kind:'RAW',sourceField}});return{stats,fieldMetadata:metadata}}
function normalizeSnapshot(rows=[],players=[],{seasons=DEFAULT_SEASONS,snapshotDate=new Date().toISOString(),fallbackResolver=null,sourceDataset=SOURCE_DATASET}={}){
  if(!Array.isArray(rows))throw new TypeError('nflverse rows must be an array');
  const allowed=new Set(seasons.map(Number)),index=buildIdentityIndex(players),records=[],unmatched=[],ambiguous=[],quarantined=[],seenRows=new Set(),canonicalSources=new Map();
  rows.forEach(row=>{
    const sourcePlayerId=clean(row.player_id||row.gsis_id),season=Number(row.season),week=row.week===undefined||row.week===null?null:Number(row.week),position=clean(row.position).toUpperCase();
    if(!allowed.has(season)||clean(row.season_type||'REG').toUpperCase()!=='REG'||!['QB','RB','WR','TE'].includes(position))return;
    if(!sourcePlayerId){quarantined.push({reason:'MISSING_SOURCE_ID',season,week});return}
    const sourceRowKey=`${sourcePlayerId}|${season}|${week??'season'}`;
    if(seenRows.has(sourceRowKey)){quarantined.push({sourcePlayerId,season,week,reason:'DUPLICATE_SOURCE_ID'});return}seenRows.add(sourceRowKey);
    if(index.duplicates.has(sourcePlayerId)){ambiguous.push({sourcePlayerId,season,week,reason:'PROVIDER_ID_MAPS_TO_MULTIPLE_CANONICAL_PLAYERS'});return}
    let player=index.map.get(sourcePlayerId),method='stable-provider-id',confidence='HIGH';
    if(!player&&typeof fallbackResolver==='function'){const result=fallbackResolver(row,players);if(result?.status==='MATCHED'){player=result.player;method=result.method||'verified-fallback';confidence=result.confidence||'MEDIUM'}else if(result?.status==='AMBIGUOUS'){ambiguous.push({sourcePlayerId,season,week,reason:'AMBIGUOUS_FALLBACK'});return}}
    if(!player){unmatched.push({sourcePlayerId,season,week,position,reason:'UNRESOLVED_PROVIDER_ID'});return}
    const canonicalPlayerId=String(player.id??player.canonicalPlayerId??player.playerId),existingSource=canonicalSources.get(canonicalPlayerId);
    if(existingSource&&existingSource!==sourcePlayerId){quarantined.push({sourcePlayerId,canonicalPlayerId,season,week,reason:'DUPLICATE_CANONICAL_ATTACHMENT'});return}canonicalSources.set(canonicalPlayerId,sourcePlayerId);
    const translated=translateStats(row);
    try{records.push(Contract.usageRecord({canonicalPlayerId,providerPlayerId:sourcePlayerId,position:player.pos??player.position,season,week,source:SOURCE,sourceDataset,snapshotDate,aggregationLevel:week===null?'SEASON':'WEEK',stats:translated.stats,fieldMetadata:translated.fieldMetadata,sample:{games:row.games,weeksObserved:week===null?row.weeks_observed:1,minimumSampleStatus:'UNASSESSED',confidence:'UNASSESSED'},matchStatus:'MATCHED',matchConfidence:confidence,identityMethod:method}))}catch(error){quarantined.push({sourcePlayerId,canonicalPlayerId,season,week,reason:'MALFORMED_RECORD',detail:error.message})}
  });
  return Object.freeze({schemaVersion:1,provider:SOURCE,sourceDataset,seasons:Object.freeze([...allowed].sort()),snapshotDate:new Date(snapshotDate).toISOString(),records:Object.freeze(records),matchedRecords:records.length,matchedPlayers:new Set(records.map(record=>record.canonicalPlayerId)).size,unmatched:Object.freeze(unmatched),ambiguous:Object.freeze(ambiguous),quarantined:Object.freeze(quarantined),unmatchedCount:unmatched.length,ambiguousCount:ambiguous.length,quarantinedCount:quarantined.length});
}
module.exports=Object.freeze({DEFAULT_SEASONS,SOURCE,SOURCE_DATASET,FIELD_MAP,buildIdentityIndex,buildVerifiedFallback,freshness,translateStats,normalizeSnapshot});
