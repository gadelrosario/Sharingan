'use strict';

const clean=value=>String(value??'').trim();
const iso=value=>{const parsed=Date.parse(value);if(!Number.isFinite(parsed))throw new TypeError('snapshotDate must be a valid date');return new Date(parsed).toISOString()};
const number=(value,field,{positive=false,nullable=true}={})=>{
  if(value===undefined||value===null||clean(value)===''){if(nullable)return null;throw new TypeError(`${field} is required`)}
  const parsed=Number(value);if(!Number.isFinite(parsed)||(positive?parsed<=0:parsed<0))throw new TypeError(`${field} must be ${positive?'positive':'non-negative'}`);return parsed;
};
const STAT_FIELDS=Object.freeze({
  QB:Object.freeze(['passAttempts','completions','passingYards','passingTouchdowns','interceptions','rushingAttempts','rushingYards','rushingTouchdowns']),
  RB:Object.freeze(['rushingAttempts','rushingYards','rushingTouchdowns','targets','receptions','receivingYards','receivingTouchdowns']),
  WR:Object.freeze(['targets','receptions','receivingYards','receivingTouchdowns','rushingAttempts','rushingYards','rushingTouchdowns']),
  TE:Object.freeze(['targets','receptions','receivingYards','receivingTouchdowns','rushingAttempts','rushingYards','rushingTouchdowns']),
});
function provenance(input={}){
  const source=clean(input.source),sourcePlayerId=clean(input.sourcePlayerId),season=number(input.season,'season',{positive:true,nullable:false});
  if(!source||!sourcePlayerId)throw new TypeError('source and sourcePlayerId are required');
  return Object.freeze({source,sourcePlayerId,season,snapshotDate:iso(input.snapshotDate),matchStatus:clean(input.matchStatus||'MATCHED').toUpperCase(),matchConfidence:clean(input.matchConfidence||'UNKNOWN').toUpperCase()});
}
function projection(input={}){
  const position=clean(input.position).toUpperCase(),fields=STAT_FIELDS[position];
  if(!fields)throw new TypeError('projection position must be QB, RB, WR, or TE');
  const playerId=clean(input.canonicalPlayerId);if(!playerId)throw new TypeError('canonicalPlayerId is required');
  const stats={};let supplied=0;
  fields.forEach(field=>{const value=number(input.stats?.[field],field);stats[field]=value;if(value!==null)supplied++});
  if(!supplied)throw new TypeError('projection must include at least one supported statistic');
  return Object.freeze({recordType:'PLAYER_PROJECTION',canonicalPlayerId:playerId,position,projectionBasis:clean(input.projectionBasis||'PRESEASON').toUpperCase(),scoringIndependent:true,stats:Object.freeze(stats),partial:supplied<fields.length,provenance:provenance(input)});
}
function marketPrice(input={}){
  const playerId=clean(input.canonicalPlayerId);if(!playerId)throw new TypeError('canonicalPlayerId is required');
  const overallAdp=number(input.overallAdp,'overallAdp',{positive:true}),positionalAdp=number(input.positionalAdp,'positionalAdp',{positive:true});
  if(overallAdp===null&&positionalAdp===null)return Object.freeze({recordType:'MARKET_PRICE',canonicalPlayerId:playerId,status:'UNAVAILABLE',overallAdp:null,positionalAdp:null,format:clean(input.format)||null,platform:clean(input.platform)||null,provenance:provenance(input)});
  return Object.freeze({recordType:'MARKET_PRICE',canonicalPlayerId:playerId,status:'AVAILABLE',overallAdp,positionalAdp,format:clean(input.format)||null,platform:clean(input.platform)||null,provenance:provenance(input)});
}
function buildExternalIndex(players=[],provider){
  const key=clean(provider),map=new Map(),duplicates=new Set();
  players.forEach(player=>{const value=clean(player.externalIds?.[key]??player[`${key}Id`]);if(!value)return;if(map.has(value))duplicates.add(value);else map.set(value,player)});
  duplicates.forEach(value=>map.delete(value));return{map,duplicates};
}
function normalizeProviderSnapshot(rows=[],players=[],options={}){
  const provider=clean(options.provider),snapshotDate=options.snapshotDate,season=options.season,index=buildExternalIndex(players,options.externalIdKey||provider.charAt(0).toLowerCase()+provider.slice(1));
  const seenSource=new Set(),seenCanonical=new Set(),projections=[],markets=[],quarantined=[];
  for(const row of rows){
    const sourcePlayerId=clean(row.sourcePlayerId);
    if(!sourcePlayerId){quarantined.push({reason:'MISSING_SOURCE_ID'});continue}
    if(seenSource.has(sourcePlayerId)||index.duplicates.has(sourcePlayerId)){quarantined.push({sourcePlayerId,reason:'DUPLICATE_SOURCE_ID'});continue}
    seenSource.add(sourcePlayerId);
    const player=index.map.get(sourcePlayerId);
    if(!player){quarantined.push({sourcePlayerId,reason:'UNKNOWN_PLAYER'});continue}
    const canonicalPlayerId=String(player.id??player.canonicalPlayerId??player.playerId);
    if(seenCanonical.has(canonicalPlayerId)){quarantined.push({sourcePlayerId,canonicalPlayerId,reason:'DUPLICATE_CANONICAL_ATTACHMENT'});continue}
    const common={...row,source:provider,sourcePlayerId,canonicalPlayerId,season,snapshotDate,matchStatus:'MATCHED',matchConfidence:'HIGH',position:player.pos??player.position};
    try{
      const nextProjection=row.stats?projection(common):null;
      const nextMarket=row.overallAdp!==undefined||row.positionalAdp!==undefined?marketPrice(common):null;
      if(!row.stats&&row.overallAdp===undefined&&row.positionalAdp===undefined)throw new TypeError('source row contains neither projection nor ADP');
      if(nextProjection)projections.push(nextProjection);
      if(nextMarket)markets.push(nextMarket);
      seenCanonical.add(canonicalPlayerId);
    }catch(error){quarantined.push({sourcePlayerId,canonicalPlayerId,reason:'MALFORMED_RECORD',detail:error.message})}
  }
  return Object.freeze({schemaVersion:1,provider,season,snapshotDate:iso(snapshotDate),projections:Object.freeze(projections),markets:Object.freeze(markets),quarantined:Object.freeze(quarantined),matchedCanonicalIds:Object.freeze([...seenCanonical])});
}

module.exports=Object.freeze({STAT_FIELDS,provenance,projection,marketPrice,buildExternalIndex,normalizeProviderSnapshot});
