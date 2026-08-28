(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FantasyHQSeasonPlayerRegistryV1=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION='fantasy-hq-season-player-registry-1';
  const REVIEW=Object.freeze({AUTO_VERIFIED:'AUTO_VERIFIED',REVIEW_REQUIRED:'REVIEW_REQUIRED',QUARANTINED:'QUARANTINED'});
  const SUPPORTED=new Set(['QB','RB','WR','TE','K','FB']);
  const FANTASY_ELIGIBLE=new Set(['QB','RB','WR','TE','K']);
  const clean=value=>String(value??'').trim();
  const normalizeName=value=>clean(value).toLowerCase().normalize('NFKD').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const normalizePosition=value=>clean(value).toUpperCase().replace(/[^A-Z]/g,'');
  const iso=(value,label)=>{const text=clean(value);if(!text||!Number.isFinite(Date.parse(text)))throw new TypeError(`${label} is invalid`);return new Date(text).toISOString()};
  const integer=(value,label,{min,max})=>{const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new TypeError(`${label} is invalid`);return number};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const stablePart=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const seasonId=({provider,providerPlayerId,gsisId})=>gsisId?`fhq_season_gsis_${stablePart(gsisId)}`:`fhq_season_${stablePart(provider)}_${stablePart(providerPlayerId)}`;
  const uniquePush=(array,value,keyFn=value=>JSON.stringify(value))=>{const key=keyFn(value);if(!array.some(item=>keyFn(item)===key))array.push(value)};

  function validateArtifact(artifact){
    if(!artifact||artifact.schemaVersion!==SCHEMA_VERSION||!Array.isArray(artifact.players))throw new TypeError('unsupported Season Player Registry schema');
    return artifact;
  }

  class SeasonPlayerRegistry{
    constructor({canonicalPlayers=[],artifact=null}={}){
      this.canonicalPlayers=canonicalPlayers;
      this.players=new Map();this.byProvider=new Map();this.byGsis=new Map();this.byNamePosition=new Map();this.quarantine=[];
      this.canonicalIds=new Set(canonicalPlayers.map(player=>clean(player?.identity?.canonicalPlayerId||player?.canonicalPlayerId||player?.playerId||player?.id)).filter(Boolean));
      this.canonicalNamePosition=new Map();
      for(const player of canonicalPlayers){const id=clean(player?.identity?.canonicalPlayerId||player?.canonicalPlayerId||player?.playerId||player?.id),name=clean(player?.name||player?.canonicalName),position=normalizePosition(player?.position||player?.pos);if(!id||!name||!position)continue;const key=`${normalizeName(name)}|${position}`,items=this.canonicalNamePosition.get(key)||[];items.push(id);this.canonicalNamePosition.set(key,items)}
      if(artifact)this.load(artifact);
    }
    load(artifact){
      validateArtifact(artifact);
      for(const source of artifact.players){const record=clone(source);this.#validateRecord(record);this.#index(record)}
      return this.status();
    }
    #validateRecord(record){
      if(!clean(record.seasonPlayerId)||!clean(record.name)||!SUPPORTED.has(normalizePosition(record.position)))throw new TypeError('Season registry player is invalid');
      if(record.draftUniverseMember!==false||record.seasonUniverseMember!==true||record.draftEligible!==false||record.recommendationEligible!==false)throw new TypeError('Season registry Draft firewall is invalid');
      if(!Object.values(REVIEW).includes(record.reviewState))throw new TypeError('Season registry review state is invalid');
    }
    #index(record){
      const id=clean(record.seasonPlayerId);if(this.players.has(id))throw new TypeError('SEASON_ID_COLLISION');
      this.players.set(id,record);
      for(const [provider,providerId] of Object.entries(record.externalIds||{})){const key=`${clean(provider).toLowerCase()}|${clean(providerId)}`;if(!clean(providerId))continue;if(this.byProvider.has(key)&&this.byProvider.get(key)!==id)throw new TypeError('PROVIDER_ID_COLLISION');this.byProvider.set(key,id)}
      if(clean(record.gsisId)){if(this.byGsis.has(record.gsisId)&&this.byGsis.get(record.gsisId)!==id)throw new TypeError('GSIS_ID_COLLISION');this.byGsis.set(record.gsisId,id)}
      const nameKey=`${normalizeName(record.name)}|${normalizePosition(record.position)}`,matches=this.byNamePosition.get(nameKey)||[];matches.push(id);this.byNamePosition.set(nameKey,matches);
    }
    find({provider,providerPlayerId,gsisId}){
      const gsis=clean(gsisId),providerKey=`${clean(provider).toLowerCase()}|${clean(providerPlayerId)}`,gsisMatch=gsis?this.byGsis.get(gsis):null,providerMatch=clean(providerPlayerId)?this.byProvider.get(providerKey):null;
      if(gsisMatch&&providerMatch&&gsisMatch!==providerMatch)return{status:REVIEW.QUARANTINED,reason:'PROVIDER_GSIS_COLLISION'};
      const id=gsisMatch||providerMatch;return id?{status:'MATCHED',record:this.players.get(id)}:null;
    }
    discover(input){
      const provider=clean(input.provider).toLowerCase(),providerPlayerId=clean(input.providerPlayerId),gsisId=clean(input.gsisId),name=clean(input.name),position=normalizePosition(input.position),team=clean(input.team).toUpperCase(),season=integer(input.season,'season',{min:2020,max:2100}),week=integer(input.week,'week',{min:1,max:22}),observedAt=iso(input.observedAt,'observedAt'),discoveredAt=iso(input.discoveredAt||input.importedAt,'discoveredAt');
      if(!provider||!providerPlayerId||!name)throw new TypeError('provider, stable provider ID, and player name are required');
      if(provider==='nflverse'&&(!gsisId||gsisId!==providerPlayerId||!/^00-\d{7}$/.test(gsisId)))return this.#reject(REVIEW.QUARANTINED,'MISSING_STABLE_GSIS_ID',input);
      if(!SUPPORTED.has(position))return this.#reject(REVIEW.QUARANTINED,'UNSUPPORTED_POSITION',input);
      const existing=this.find({provider,providerPlayerId,gsisId});if(existing?.status===REVIEW.QUARANTINED)return this.#reject(REVIEW.QUARANTINED,existing.reason,input);
      if(existing?.record){const record=existing.record,providerKey=`${provider}|${providerPlayerId}`,providerMapped=this.byProvider.get(providerKey),gsisMapped=gsisId?this.byGsis.get(gsisId):null;if(providerMapped&&providerMapped!==record.seasonPlayerId)return this.#reject(REVIEW.QUARANTINED,'PROVIDER_ID_COLLISION',input,[providerMapped,record.seasonPlayerId]);if(gsisMapped&&gsisMapped!==record.seasonPlayerId)return this.#reject(REVIEW.QUARANTINED,'GSIS_ID_COLLISION',input,[gsisMapped,record.seasonPlayerId]);if(record.gsisId&&gsisId&&record.gsisId!==gsisId)return this.#reject(REVIEW.QUARANTINED,'PROVIDER_GSIS_COLLISION',input,[record.seasonPlayerId]);if(normalizeName(record.name)!==normalizeName(name))return this.#reject(REVIEW.QUARANTINED,'GSIS_IDENTITY_COLLISION',input,[record.seasonPlayerId]);this.byProvider.set(providerKey,record.seasonPlayerId);if(gsisId)this.byGsis.set(gsisId,record.seasonPlayerId);this.#observe(record,{provider,providerPlayerId,gsisId,position,team,season,week,observedAt,discoveredAt});return{status:'MATCHED',created:false,record}}
      const nameKey=`${normalizeName(name)}|${position}`,canonicalMatches=this.canonicalNamePosition.get(nameKey)||[],seasonMatches=this.byNamePosition.get(nameKey)||[];
      if(canonicalMatches.length||seasonMatches.length)return this.#reject(REVIEW.REVIEW_REQUIRED,canonicalMatches.length?'POSSIBLE_CANONICAL_DUPLICATE':'POSSIBLE_SEASON_DUPLICATE',input,[...canonicalMatches,...seasonMatches]);
      const id=seasonId({provider,providerPlayerId,gsisId});if(this.canonicalIds.has(id)||this.players.has(id))return this.#reject(REVIEW.QUARANTINED,'SEASON_ID_COLLISION',input,[id]);
      const record={seasonPlayerId:id,canonicalPlayerId:id,name,normalizedName:normalizeName(name),position,teamAtObservation:team||null,seasonDiscovered:season,weekDiscovered:week,firstSeenAt:observedAt,lastSeenAt:observedAt,discoveredAt,discoveryProvenance:{provider,providerPlayerId,gsisId:gsisId||null,source:clean(input.source)||provider,sourceRecordId:clean(input.sourceRecordId)||null},externalIds:{[provider]:providerPlayerId},gsisId:gsisId||null,identityConfidence:'HIGH',identityMethod:gsisId?'stable-gsis-auto-discovery':'stable-provider-auto-discovery',reviewState:REVIEW.AUTO_VERIFIED,draftUniverseMember:false,seasonUniverseMember:true,draftEligible:false,recommendationEligible:false,fantasyPositionEligible:FANTASY_ELIGIBLE.has(position),draftRank:null,draftTier:null,yahooAvailability:null,observedTeams:[],observedPositions:[],positionConflict:false};
      this.#observe(record,{provider,providerPlayerId,gsisId,position,team,season,week,observedAt,discoveredAt});this.#index(record);return{status:REVIEW.AUTO_VERIFIED,created:true,record};
    }
    #observe(record,observation){
      record.lastSeenAt=[record.lastSeenAt,observation.observedAt].filter(Boolean).sort().at(-1);record.discoveredAt=record.discoveredAt||observation.discoveredAt;
      uniquePush(record.observedTeams,{team:observation.team||null,season:observation.season,week:observation.week,observedAt:observation.observedAt},item=>`${item.team}|${item.season}|${item.week}`);
      uniquePush(record.observedPositions,{position:observation.position,season:observation.season,week:observation.week,observedAt:observation.observedAt},item=>`${item.position}|${item.season}|${item.week}`);
      record.positionConflict=record.observedPositions.some(item=>item.position!==record.position);
      if(observation.provider&&observation.providerPlayerId)record.externalIds[observation.provider]=observation.providerPlayerId;
    }
    #reject(status,reason,input,candidates=[]){const result={status,reason,provider:clean(input.provider)||null,providerPlayerId:clean(input.providerPlayerId)||null,gsisId:clean(input.gsisId)||null,name:clean(input.name)||null,position:normalizePosition(input.position)||null,candidates:[...candidates]};this.quarantine.push(result);return result}
    evidencePlayers(){return[...this.players.values()].filter(record=>record.reviewState===REVIEW.AUTO_VERIFIED).map(record=>({id:record.seasonPlayerId,canonicalPlayerId:record.seasonPlayerId,playerId:record.seasonPlayerId,name:record.name,pos:record.position,position:record.position,team:record.teamAtObservation,nflTeam:record.teamAtObservation,externalIds:{...record.externalIds,gsis:record.gsisId},seasonOnly:true,draftUniverseMember:false,seasonUniverseMember:true,draftEligible:false,recommendationEligible:false,draftRank:null,draftTier:null,reviewState:record.reviewState}))}
    get(id){return this.players.get(clean(id))||null}
    status(){const records=[...this.players.values()];return{schemaVersion:SCHEMA_VERSION,seasonIdentities:records.length,autoVerified:records.filter(item=>item.reviewState===REVIEW.AUTO_VERIFIED).length,reviewRequired:records.filter(item=>item.reviewState===REVIEW.REVIEW_REQUIRED).length,quarantined:this.quarantine.length,byPosition:Object.fromEntries([...SUPPORTED].sort().map(position=>[position,records.filter(item=>item.position===position).length])),draftEligible:records.filter(item=>item.draftEligible).length,recommendationEligible:records.filter(item=>item.recommendationEligible).length}}
    toArtifact({generatedAt,sourceArtifact=null}={}){const players=[...this.players.values()].map(clone).sort((a,b)=>a.seasonPlayerId.localeCompare(b.seasonPlayerId));return{schemaVersion:SCHEMA_VERSION,generatedAt:iso(generatedAt,'generatedAt'),sourceArtifact:sourceArtifact||null,profileIndependent:true,recommendationAuthority:false,draftAuthority:false,players}}
  }

  return Object.freeze({SCHEMA_VERSION,REVIEW,SUPPORTED_POSITIONS:Object.freeze([...SUPPORTED]),FANTASY_ELIGIBLE_POSITIONS:Object.freeze([...FANTASY_ELIGIBLE]),normalizeName,normalizePosition,seasonId,validateArtifact,SeasonPlayerRegistry});
});
