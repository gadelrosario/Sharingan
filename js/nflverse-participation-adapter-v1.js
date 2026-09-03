(function(root,factory){
  const evidence=typeof module!=='undefined'&&module.exports?require('./season-evidence-v1.js'):root.FantasyHQSeasonEvidenceV1;
  const identity=typeof module!=='undefined'&&module.exports?require('./nflverse-evidence-adapter-v1.js'):root.FantasyHQNflverseEvidenceAdapterV1;
  const api=factory(evidence,identity);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FantasyHQNflverseParticipationAdapterV1=api;
})(typeof window!=='undefined'?window:globalThis,function(Evidence,Identity){
  'use strict';
  if(!Evidence||!Identity)throw new Error('Fantasy HQ Season Evidence and nflverse identity adapters are required');

  const RAW_SCHEMA_VERSION='nflverse-snap-counts-csv-1';
  const ARTIFACT_SCHEMA_VERSION='fantasy-hq-participation-evidence-artifact-1';
  const PROVIDER='nflverse';
  const SOURCE_NAME='nflverse snap counts';
  const SOURCE_DATASET='snap_counts';
  const SUPPORTED_POSITIONS=new Set(['QB','RB','WR','TE','K','FB']);
  const clean=value=>String(value??'').trim();
  const freeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(freeze);return Object.freeze(value)};
  const iso=(value,label)=>{const text=clean(value);if(!text||!Number.isFinite(Date.parse(text)))throw new TypeError(`${label} must be an ISO timestamp`);return new Date(text).toISOString()};
  const integer=(value,label,{min=-Infinity,max=Infinity}={})=>{if(value===null||value===undefined||clean(value)==='')return null;const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new TypeError(`${label} is invalid`);return number};
  const numeric=(value,label,{min=-Infinity,max=Infinity}={})=>{if(value===null||value===undefined||clean(value)==='')return null;const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)throw new TypeError(`${label} is invalid`);return number};
  const normalizePosition=value=>clean(value).toUpperCase().replace(/[^A-Z]/g,'');
  const bump=(object,key)=>{object[key]=(object[key]||0)+1};
  function reasonKey(error){const message=String(error?.message||error);if(message.includes('PFR_ID_AMBIGUOUS')||message.includes('IDENTITY_AMBIGUOUS'))return'identityAmbiguous';if(message.includes('PFR_ID_UNRESOLVED')||message.includes('IDENTITY_UNRESOLVED'))return'identityUnresolved';if(message.includes('REGISTRY_REVIEW_REQUIRED'))return'registryReviewRequired';if(message.includes('REGISTRY_QUARANTINED'))return'registryQuarantined';if(message.includes('REGISTRY_COLLISION'))return'registryCollision';if(message.includes('UNSUPPORTED_POSITION'))return'unsupportedPosition';if(message.includes('DUPLICATE_CONFLICT'))return'duplicateConflict';if(message.includes('required'))return'missingRequiredField';if(message.includes('invalid'))return'malformedRecord';return'normalizationWarning'}

  function buildPfrIndex(playerDirectoryRows=[]){
    const index=new Map();
    for(const row of playerDirectoryRows){const pfrId=clean(row.pfr_id),gsisId=clean(row.gsis_id);if(!pfrId||!gsisId)continue;const values=index.get(pfrId)||[];values.push({pfrId,gsisId,name:clean(row.display_name),position:normalizePosition(row.position),team:clean(row.latest_team).toUpperCase()||null});index.set(pfrId,values)}
    return index;
  }
  function observationTimestamp(pfrGameId){const match=clean(pfrGameId).match(/^(\d{4})(\d{2})(\d{2})/);if(!match)throw new TypeError('pfr_game_id date is invalid');return iso(`${match[1]}-${match[2]}-${match[3]}T23:59:59.000Z`,'observedAt')}
  function resolvePfrIdentity(row,pfrIndex){const pfrId=clean(row.pfr_player_id),matches=pfrIndex.get(pfrId)||[];if(!pfrId)throw new TypeError('pfr_player_id is required');if(matches.length===0)throw new TypeError('PFR_ID_UNRESOLVED');if(matches.length>1||new Set(matches.map(item=>item.gsisId)).size!==1)throw new TypeError('PFR_ID_AMBIGUOUS');return matches[0]}

  function normalizeRow(row,{pfrIndex,gsisIndex,canonicalIndex,retrievedAt,providerUpdatedAt,seasonRegistry=null}){
    if(!row||typeof row!=='object'||Array.isArray(row))throw new TypeError('provider row is malformed');
    const season=integer(row.season,'season',{min:2020,max:2100}),week=integer(row.week,'week',{min:1,max:22});
    if(clean(row.game_type).toUpperCase()!=='REG')throw new TypeError('game_type is not covered');
    const position=normalizePosition(row.position);if(!SUPPORTED_POSITIONS.has(position))throw new TypeError('UNSUPPORTED_POSITION');
    const name=clean(row.player),team=clean(row.team).toUpperCase(),opponent=clean(row.opponent).toUpperCase(),gameId=clean(row.game_id),pfrGameId=clean(row.pfr_game_id);
    if(!name||!team||!gameId||!pfrGameId)throw new TypeError('player, team, game_id, and pfr_game_id are required');
    const pfrIdentity=resolvePfrIdentity(row,pfrIndex),observedAt=observationTimestamp(pfrGameId);
    const offensiveSnaps=integer(row.offense_snaps,'offense_snaps',{min:0,max:200}),offensiveSnapShare=numeric(row.offense_pct,'offense_pct',{min:0,max:1});
    if(offensiveSnaps===null&&offensiveSnapShare===null)throw new TypeError('offensive participation is required');
    const identity=Identity.resolveIdentity({player_id:pfrIdentity.gsisId,player_display_name:name,position,team,season,week,game_id:gameId},gsisIndex,canonicalIndex,seasonRegistry,{observedAt,retrievedAt});
    return {sourceRecordId:`snap-counts:${gameId}:${pfrIdentity.gsisId}`,canonicalPlayerId:identity.canonicalPlayerId,sourcePlayerId:pfrIdentity.gsisId,sourcePfrPlayerId:pfrIdentity.pfrId,name,position,nflTeam:team,season,week,gameId,observedAt,fetchedAt:retrievedAt,providerUpdatedAt,identityConfidence:identity.confidence,rawDerived:'RAW',sourceEvidenceIds:[`${PROVIDER}:${SOURCE_DATASET}:${gameId}:${pfrIdentity.pfrId}`],role:{offensiveSnaps,offensiveSnapShare,snapShare:offensiveSnapShare,routesRun:null,routeParticipation:null,passPlayParticipation:null,routes:null},matchup:{opponent:opponent||null},source:{name:SOURCE_NAME,provider:PROVIDER,type:'OBJECTIVE_NFL_PARTICIPATION',hostPlatform:'GitHub Releases',confidence:'HIGH'},sourceDataset:SOURCE_DATASET,seasonOnlyIdentity:identity.seasonOnly===true,registryCreated:identity.registryCreated===true};
  }

  class NflverseParticipationAdapter extends Evidence.EvidenceProviderAdapter{
    constructor(){super({provider:PROVIDER})}
    validate(payload){return Boolean(payload&&payload.schemaVersion===RAW_SCHEMA_VERSION&&Array.isArray(payload.rows)&&Array.isArray(payload.playerDirectoryRows)&&payload.retrievedAt&&payload.providerUpdatedAt)}
    normalize(payload,{players=[],aliases={},gsisMappings=[],seasonRegistry=null}={}){
      if(!this.validate(payload))throw new TypeError('unsupported nflverse snap-count provider schema');
      const retrievedAt=iso(payload.retrievedAt,'retrievedAt'),providerUpdatedAt=iso(payload.providerUpdatedAt,'providerUpdatedAt'),pfrIndex=buildPfrIndex(payload.playerDirectoryRows),gsisIndex=Identity.buildGsisIndex(gsisMappings),canonicalIndex=Evidence.buildIdentityIndex(players,aliases);
      const quality={recordsReceived:payload.rows.length,recordsAccepted:0,recordsRejected:0,playersResolved:0,existingCanonicalMatches:0,existingSeasonRegistryMatches:0,newSeasonIdentitiesCreated:0,unresolvedPlayers:0,ambiguousIdentities:0,duplicateRecords:0,conflicts:0,unsupportedPositions:0,reasons:{},familyCoverage:{role:0,matchup:0,routes:0},rejected:[]};
      const records=[],seen=new Map(),playersResolved=new Set(),canonicalMatches=new Set(),seasonMatches=new Set(),newSeasonIdentities=new Set();
      for(const row of payload.rows){try{const record=normalizeRow(row,{pfrIndex,gsisIndex,canonicalIndex,retrievedAt,providerUpdatedAt,seasonRegistry}),key=record.sourceRecordId,signature=JSON.stringify(record);if(seen.has(key)){quality.duplicateRecords+=1;const conflict=seen.get(key)!==signature;bump(quality.reasons,conflict?'duplicateConflict':'duplicateRecord');if(conflict)quality.conflicts+=1;continue}seen.set(key,signature);records.push(record);playersResolved.add(record.canonicalPlayerId);quality.recordsAccepted+=1;quality.familyCoverage.role+=1;if(record.matchup?.opponent)quality.familyCoverage.matchup+=1;if(record.role.routesRun!==null)quality.familyCoverage.routes+=1;if(record.seasonOnlyIdentity){seasonMatches.add(record.canonicalPlayerId);if(record.registryCreated)newSeasonIdentities.add(record.canonicalPlayerId)}else canonicalMatches.add(record.canonicalPlayerId)}catch(error){const reason=reasonKey(error);bump(quality.reasons,reason);quality.recordsRejected+=1;if(reason==='identityUnresolved')quality.unresolvedPlayers+=1;if(reason==='identityAmbiguous')quality.ambiguousIdentities+=1;if(reason==='unsupportedPosition')quality.unsupportedPositions+=1;quality.rejected.push({pfrPlayerId:clean(row?.pfr_player_id)||null,gameId:clean(row?.game_id)||null,reason:String(error.message)})}}
      records.sort((a,b)=>a.season-b.season||a.week-b.week||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)||a.sourceRecordId.localeCompare(b.sourceRecordId));
      Object.assign(quality,{playersResolved:playersResolved.size,existingCanonicalMatches:canonicalMatches.size,existingSeasonRegistryMatches:seasonMatches.size-newSeasonIdentities.size,newSeasonIdentitiesCreated:newSeasonIdentities.size});
      const weeks=[...new Set(records.map(record=>record.week))].sort((a,b)=>a-b),season=records[0]?.season??integer(payload.season,'season',{min:2020,max:2100}),currentSeason=integer(payload.currentSeason??season,'currentSeason',{min:2020,max:2100}),historical=season<currentSeason;
      const artifact={schemaVersion:Evidence.SCHEMA_VERSION,artifactSchemaVersion:ARTIFACT_SCHEMA_VERSION,provider:PROVIDER,source:SOURCE_NAME,sourceDataset:SOURCE_DATASET,license:'CC-BY-4.0',attribution:'Pro Football Reference data distributed by nflverse',sourceUrl:clean(payload.sourceUrl)||null,playerDirectoryUrl:clean(payload.playerDirectoryUrl)||null,generatedAt:retrievedAt,providerUpdatedAt,season,weeks,currentSeason,evidenceStatus:historical?'HISTORICAL_STALE':'CURRENT',currentActionableEvidence:!historical,recordCount:records.length,recommendationAuthority:false,transactionAuthority:false,routeDataAvailable:false,records};
      return freeze({provider:PROVIDER,artifact:freeze(artifact),qualityReport:freeze({...quality,rejected:quality.rejected.slice(0,50),provider:PROVIDER,season,weeks,currentSeason,evidenceStatus:artifact.evidenceStatus,generatedAt:retrievedAt,providerUpdatedAt,recommendationAuthority:false,transactionAuthority:false})});
    }
  }
  return freeze({RAW_SCHEMA_VERSION,ARTIFACT_SCHEMA_VERSION,PROVIDER,SOURCE_NAME,SOURCE_DATASET,SUPPORTED_POSITIONS,buildPfrIndex,observationTimestamp,resolvePfrIdentity,normalizeRow,NflverseParticipationAdapter});
});
