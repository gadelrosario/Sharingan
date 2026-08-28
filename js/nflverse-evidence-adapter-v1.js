(function(root,factory){
  const evidence=typeof module!=='undefined'&&module.exports?require('./season-evidence-v1.js'):root.FantasyHQSeasonEvidenceV1;
  const api=factory(evidence);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FantasyHQNflverseEvidenceAdapterV1=api;
})(typeof window!=='undefined'?window:globalThis,function(Evidence){
  'use strict';
  if(!Evidence)throw new Error('FantasyHQSeasonEvidenceV1 is required');

  const RAW_SCHEMA_VERSION='nflverse-stats-player-week-csv-1';
  const ARTIFACT_SCHEMA_VERSION='fantasy-hq-nfl-evidence-artifact-1';
  const PROVIDER='nflverse';
  const SOURCE_NAME='nflverse weekly player stats';
  const clean=value=>String(value??'').trim();
  const freeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(freeze);return Object.freeze(value)};
  const iso=(value,label)=>{const text=clean(value);if(!text||!Number.isFinite(Date.parse(text)))throw new TypeError(`${label} must be an ISO timestamp`);return new Date(text).toISOString()};
  const integer=(value,label,{min=-Infinity,max=Infinity}={})=>{const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new TypeError(`${label} is invalid`);return number};
  const numeric=(value,label,{min=-Infinity,max=Infinity}={})=>{if(value===null||value===undefined||clean(value)==='')return null;const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)throw new TypeError(`${label} is invalid`);return number};
  const normalizePosition=value=>{const position=clean(value).toUpperCase().replace(/[^A-Z]/g,'');return ['DEF','DEFENSE','DST'].includes(position)?'DST':position};
  const sumKnown=(...values)=>values.every(value=>value!==null)?values.reduce((sum,value)=>sum+value,0):null;
  const reasonKey=error=>{
    const message=String(error?.message||error);
    if(message.includes('UNSUPPORTED_POSITION'))return'unsupportedPosition';
    if(message.includes('REGISTRY_REVIEW_REQUIRED'))return'registryReviewRequired';
    if(message.includes('REGISTRY_COLLISION'))return'registryCollision';
    if(message.includes('REGISTRY_QUARANTINED'))return'registryQuarantined';
    if(message.includes('IDENTITY_AMBIGUOUS'))return'identityAmbiguous';
    if(message.includes('IDENTITY_UNRESOLVED'))return'identityUnresolved';
    if(message.includes('duplicate'))return'duplicateRecord';
    if(message.includes('required')||message.includes('schema'))return'missingRequiredField';
    if(message.includes('invalid'))return'malformedRecord';
    return'normalizationWarning';
  };
  const bump=(object,key)=>{object[key]=(object[key]||0)+1};

  function buildGsisIndex(mappings=[]){
    const index=new Map();
    for(const mapping of mappings){
      const gsisId=clean(mapping?.gsisId),canonicalPlayerId=clean(mapping?.canonicalPlayerId);
      if(!gsisId||!canonicalPlayerId)continue;
      const matches=index.get(gsisId)||[];
      matches.push(mapping);
      index.set(gsisId,matches);
    }
    return index;
  }

  function registryIdentity(result){
    if(result?.record)return freeze({canonicalPlayerId:clean(result.record.seasonPlayerId),method:'season-registry',confidence:clean(result.record.identityConfidence).toUpperCase()||'HIGH',seasonOnly:true,registryCreated:result.created===true,reviewState:result.record.reviewState});
    const reason=clean(result?.reason),review=clean(result?.status);
    const prefix=reason==='UNSUPPORTED_POSITION'?'UNSUPPORTED_POSITION':review==='REVIEW_REQUIRED'?'REGISTRY_REVIEW_REQUIRED':reason.includes('COLLISION')?'REGISTRY_COLLISION':'REGISTRY_QUARANTINED';
    const error=new TypeError(`${prefix}:${reason||'UNSAFE_IDENTITY'}`);error.identity=result;throw error;
  }

  function resolveIdentity(row,gsisIndex,canonicalIndex,seasonRegistry=null,observation={}){
    const sourcePlayerId=clean(row.player_id);
    if(!sourcePlayerId)throw new TypeError('player_id is required');
    const gsisMatches=gsisIndex.get(sourcePlayerId)||[];
    if(gsisMatches.length>1){const error=new TypeError('IDENTITY_AMBIGUOUS');error.identity={status:'IDENTITY_AMBIGUOUS',sourcePlayerId,candidates:gsisMatches.map(item=>clean(item.canonicalPlayerId))};throw error}
    if(gsisMatches.length===1)return freeze({canonicalPlayerId:clean(gsisMatches[0].canonicalPlayerId),method:'gsis-crosswalk',confidence:clean(gsisMatches[0].matchConfidence).toUpperCase()||'HIGH'});
    const registered=seasonRegistry?.find({provider:PROVIDER,providerPlayerId:sourcePlayerId,gsisId:sourcePlayerId});
    if(registered)return registryIdentity(registered);
    const fallback=Evidence.reconcileIdentity({provider:PROVIDER,sourcePlayerId,name:row.player_display_name,position:row.position,nflTeam:row.team},canonicalIndex);
    if(['MATCHED','ALIAS_MATCH'].includes(fallback.status))return freeze({canonicalPlayerId:fallback.canonicalPlayerId,method:fallback.method,confidence:fallback.method==='normalized-name-position'?'BOUNDED_FALLBACK':'APPROVED_ALIAS'});
    if(seasonRegistry)return registryIdentity(seasonRegistry.discover({provider:PROVIDER,providerPlayerId:sourcePlayerId,gsisId:sourcePlayerId,name:row.player_display_name,position:row.position,team:row.team,season:row.season,week:row.week,observedAt:observation.observedAt,discoveredAt:observation.retrievedAt,source:SOURCE_NAME,sourceRecordId:`${clean(row.game_id)}:${sourcePlayerId}`}));
    const error=new TypeError(fallback.status);error.identity=fallback;throw error;
  }

  function normalizeRow(row,{gsisIndex,canonicalIndex,retrievedAt,providerUpdatedAt,scheduleByGame,seasonRegistry=null}){
    if(!row||typeof row!=='object'||Array.isArray(row))throw new TypeError('provider row is malformed');
    const season=integer(row.season,'season',{min:2020,max:2100}),week=integer(row.week,'week',{min:1,max:22});
    if(clean(row.season_type).toUpperCase()!=='REG')throw new TypeError('season_type is not covered');
    const position=normalizePosition(row.position),name=clean(row.player_display_name),team=clean(row.team).toUpperCase(),gameId=clean(row.game_id);
    if(!name||!position||!team||!gameId)throw new TypeError('name, position, team, and game_id are required');
    const game=scheduleByGame.get(gameId);
    if(!game?.gameday)throw new TypeError('game observation timestamp is required');
    const observedAt=iso(`${game.gameday}T23:59:59.000Z`,'observedAt');
    const carries=numeric(row.carries,'carries',{min:0,max:100}),targets=numeric(row.targets,'targets',{min:0,max:100}),receptions=numeric(row.receptions,'receptions',{min:0,max:100});
    const receivingYards=numeric(row.receiving_yards,'receiving_yards',{min:-100,max:1000}),rushingYards=numeric(row.rushing_yards,'rushing_yards',{min:-100,max:1000});
    const rushingTds=numeric(row.rushing_tds,'rushing_tds',{min:0,max:20}),receivingTds=numeric(row.receiving_tds,'receiving_tds',{min:0,max:20}),fantasyPoints=numeric(row.fantasy_points_ppr,'fantasy_points_ppr',{min:-50,max:200});
    const targetShare=numeric(row.target_share,'target_share',{min:0,max:1});
    const opportunity={targets,targetShare,carries,touches:sumKnown(carries,receptions),opportunities:sumKnown(carries,targets)};
    const production={receptions,receivingYards,rushingYards,touchdowns:sumKnown(rushingTds,receivingTds),fantasyPoints};
    if(!Object.values(opportunity).some(value=>value!==null)||!Object.values(production).some(value=>value!==null))throw new TypeError('provider row contains no supported evidence');
    const identity=resolveIdentity(row,gsisIndex,canonicalIndex,seasonRegistry,{observedAt,retrievedAt});
    return {
      sourceRecordId:`${gameId}:${clean(row.player_id)}`,
      canonicalPlayerId:identity.canonicalPlayerId,
      sourcePlayerId:clean(row.player_id),
      name,position,nflTeam:team,season,week,gameId,
      observedAt,fetchedAt:retrievedAt,providerUpdatedAt,
      identityConfidence:identity.confidence,
      rawDerived:'MIXED',
      sourceEvidenceIds:[`${PROVIDER}:${gameId}:${clean(row.player_id)}`],
      opportunity,
      production,
      matchup:{opponent:clean(row.opponent_team).toUpperCase()||null},
      source:{name:SOURCE_NAME,provider:PROVIDER,type:'OBJECTIVE_NFL_WEEKLY_STATS',hostPlatform:'GitHub Releases',confidence:'HIGH'},
      seasonOnlyIdentity:identity.seasonOnly===true,
      registryCreated:identity.registryCreated===true,
    };
  }

  class NflverseEvidenceAdapter extends Evidence.EvidenceProviderAdapter{
    constructor(){super({provider:PROVIDER})}
    validate(payload){return Boolean(payload&&payload.schemaVersion===RAW_SCHEMA_VERSION&&Array.isArray(payload.rows)&&payload.retrievedAt&&payload.providerUpdatedAt)}
    async fetch(url,{fetchFn=globalThis.fetch,timeoutMs=30000}={}){if(typeof fetchFn!=='function')throw new Error('provider fetch is unavailable');const controller=typeof AbortController==='function'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;try{const response=await fetchFn(url,{signal:controller?.signal});if(!response?.ok)throw new Error(`nflverse returned HTTP ${response?.status??'UNKNOWN'}`);return await response.text()}finally{if(timer)clearTimeout(timer)}}
    normalize(payload,{players=[],aliases={},gsisMappings=[],scheduleRows=[],seasonRegistry=null}={}){
      if(!this.validate(payload))throw new TypeError('unsupported nflverse provider schema');
      const retrievedAt=iso(payload.retrievedAt,'retrievedAt'),providerUpdatedAt=iso(payload.providerUpdatedAt,'providerUpdatedAt');
      const canonicalIndex=Evidence.buildIdentityIndex(players,aliases),gsisIndex=buildGsisIndex(gsisMappings),scheduleByGame=new Map(scheduleRows.map(row=>[clean(row.game_id),row]));
      const quality={recordsReceived:payload.rows.length,recordsAccepted:0,recordsRejected:0,playersResolved:0,unresolvedPlayers:0,ambiguousIdentities:0,duplicateRecords:0,missingRequiredFields:0,staleRecords:0,conflicts:0,normalizationWarnings:0,existingCanonicalMatches:0,existingSeasonRegistryMatches:0,newSeasonIdentitiesCreated:0,autoVerifiedIdentities:0,reviewRequiredIdentities:0,quarantinedIdentities:0,unsupportedPositions:0,registryCollisions:0,evidenceAcceptedAfterRegistration:0,newSeasonIdentitiesByPosition:{},reasons:{},familyCoverage:{opportunity:0,production:0,matchup:0},rejected:[]};
      const records=[],seen=new Map(),playersResolved=new Set(),canonicalMatches=new Set(),seasonMatches=new Set(),newSeasonIdentities=new Set(),reviewRequired=new Set(),quarantined=new Set(),unsupported=new Set(),collisions=new Set();
      for(const row of payload.rows){
        try{
          const record=normalizeRow(row,{gsisIndex,canonicalIndex,retrievedAt,providerUpdatedAt,scheduleByGame,seasonRegistry}),key=record.sourceRecordId,signature=JSON.stringify(record);
          if(seen.has(key)){bump(quality.reasons,seen.get(key)===signature?'duplicateRecord':'duplicateConflict');quality.duplicateRecords+=1;if(seen.get(key)!==signature)quality.conflicts+=1;continue}
          seen.set(key,signature);records.push(record);playersResolved.add(record.canonicalPlayerId);quality.recordsAccepted+=1;
          if(record.seasonOnlyIdentity){seasonMatches.add(record.canonicalPlayerId);if(record.registryCreated){newSeasonIdentities.add(record.canonicalPlayerId);quality.newSeasonIdentitiesByPosition[record.position]=(quality.newSeasonIdentitiesByPosition[record.position]||0)+1}}else canonicalMatches.add(record.canonicalPlayerId);
          for(const family of Object.keys(quality.familyCoverage))if(record[family])quality.familyCoverage[family]+=1;
        }catch(error){const reason=reasonKey(error),sourceId=clean(row?.player_id)||clean(row?.player_display_name)||'MISSING';bump(quality.reasons,reason);quality.recordsRejected+=1;if(reason==='identityUnresolved')quality.unresolvedPlayers+=1;if(reason==='identityAmbiguous')quality.ambiguousIdentities+=1;if(reason==='missingRequiredField')quality.missingRequiredFields+=1;if(reason==='normalizationWarning'||reason==='malformedRecord')quality.normalizationWarnings+=1;if(reason==='unsupportedPosition')unsupported.add(sourceId);if(reason==='registryReviewRequired')reviewRequired.add(sourceId);if(reason==='registryQuarantined')quarantined.add(sourceId);if(reason==='registryCollision')collisions.add(sourceId);quality.rejected.push({sourcePlayerId:clean(row?.player_id)||null,gameId:clean(row?.game_id)||null,reason:String(error.message),identity:error.identity||null})}
      }
      quality.playersResolved=playersResolved.size;
      quality.existingCanonicalMatches=canonicalMatches.size;quality.existingSeasonRegistryMatches=seasonMatches.size-newSeasonIdentities.size;quality.newSeasonIdentitiesCreated=newSeasonIdentities.size;quality.autoVerifiedIdentities=newSeasonIdentities.size;quality.reviewRequiredIdentities=reviewRequired.size;quality.quarantinedIdentities=quarantined.size;quality.unsupportedPositions=unsupported.size;quality.registryCollisions=collisions.size;
      quality.evidenceAcceptedAfterRegistration=records.filter(record=>record.seasonOnlyIdentity&&newSeasonIdentities.has(record.canonicalPlayerId)).length;
      quality.newSeasonIdentitiesByPosition=Object.fromEntries(Object.entries(quality.newSeasonIdentitiesByPosition).map(([position,count])=>[position,new Set(records.filter(record=>record.registryCreated&&record.position===position).map(record=>record.canonicalPlayerId)).size]));
      records.sort((a,b)=>a.season-b.season||a.week-b.week||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)||a.sourceRecordId.localeCompare(b.sourceRecordId));
      const weeks=[...new Set(records.map(record=>record.week))].sort((a,b)=>a-b),season=records[0]?.season??integer(payload.season,'season',{min:2020,max:2100});
      const artifact={schemaVersion:Evidence.SCHEMA_VERSION,artifactSchemaVersion:ARTIFACT_SCHEMA_VERSION,seasonRegistrySchemaVersion:seasonRegistry?.status?.().schemaVersion||null,provider:PROVIDER,source:SOURCE_NAME,license:'CC-BY-4.0',sourceUrl:clean(payload.sourceUrl)||null,generatedAt:retrievedAt,providerUpdatedAt,season,weeks,recordCount:records.length,recommendationAuthority:false,records};
      return freeze({provider:PROVIDER,artifact:freeze(artifact),qualityReport:freeze({...quality,rejected:quality.rejected.slice(0,25),provider:PROVIDER,season,weeks,generatedAt:retrievedAt,providerUpdatedAt,recommendationAuthority:false})});
    }
  }

  return freeze({RAW_SCHEMA_VERSION,ARTIFACT_SCHEMA_VERSION,PROVIDER,SOURCE_NAME,buildGsisIndex,resolveIdentity,normalizeRow,NflverseEvidenceAdapter});
});
