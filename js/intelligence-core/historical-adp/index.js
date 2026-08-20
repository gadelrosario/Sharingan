'use strict';

const Identity=require('../../sleeper-injury-adapter-v1.js');

const PROVIDER='Fantasy Football Calculator';
const PROVIDER_KEY='FANTASY_FOOTBALL_CALCULATOR';
const POSITIONS=Object.freeze(['QB','RB','WR','TE']);
const OUTCOME_CLASSES=Object.freeze([
  Object.freeze({label:'ELITE_APPRECIATION',minimumAdpGain:72,economicMeaning:'At least six 12-team rounds of appreciation.'}),
  Object.freeze({label:'MAJOR_APPRECIATION',minimumAdpGain:48,economicMeaning:'At least four 12-team rounds of appreciation.'}),
  Object.freeze({label:'MEANINGFUL_APPRECIATION',minimumAdpGain:24,economicMeaning:'At least two 12-team rounds of appreciation.'}),
  Object.freeze({label:'NO_APPRECIATION',minimumAdpGain:-Infinity,economicMeaning:'Less than two 12-team rounds of appreciation.'}),
]);
const clean=value=>String(value??'').trim();
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const normalizeName=Identity.normalizeName;
const normalizePosition=Identity.normalizePosition;

function canonicalIndex(players=[]){
  const byIdentity=new Map();
  for(const player of players){
    const position=normalizePosition(player.pos||player.position);
    if(!POSITIONS.includes(position))continue;
    const names=[player.name,...(player.identityAliases||[]),...(player.aliases||[]),...(player.legacyNames||[])];
    for(const name of names){
      const key=`${normalizeName(name)}|${position}`;
      if(!byIdentity.has(key))byIdentity.set(key,new Map());
      byIdentity.get(key).set(String(player.id),player);
    }
  }
  return new Map([...byIdentity].map(([key,value])=>[key,[...value.values()]]));
}

function sourceIdentityUniverse(rawSnapshot={}){
  const identities=new Map(),quarantined=[];
  for(const season of rawSnapshot.seasons||[]){
    const seen=new Set();
    for(const row of season.players||[]){
      const sourcePlayerId=clean(row.player_id),position=normalizePosition(row.position),name=clean(row.name),key=`${season.requestedYear}|${sourcePlayerId}`;
      if(!sourcePlayerId||!name||!position||finite(row.adp)===null){quarantined.push({season:season.requestedYear,sourcePlayerId,name,position,reason:'MALFORMED_SOURCE_ROW'});continue}
      if(seen.has(key)){quarantined.push({season:season.requestedYear,sourcePlayerId,name,position,reason:'DUPLICATE_PROVIDER_ID_IN_SEASON'});continue}seen.add(key);
      if(!identities.has(sourcePlayerId))identities.set(sourcePlayerId,{sourcePlayerId,names:new Set(),positions:new Set(),seasons:new Set()});
      const identity=identities.get(sourcePlayerId);identity.names.add(name);identity.positions.add(position);identity.seasons.add(Number(season.requestedYear));
    }
  }
  return{identities,quarantined};
}

function reconcileIdentities(rawSnapshot,players=[]){
  const current=canonicalIndex(players),{identities,quarantined}=sourceIdentityUniverse(rawSnapshot),mappings=[],ambiguous=[];
  for(const identity of identities.values()){
    if(identity.positions.size!==1){ambiguous.push({sourcePlayerId:identity.sourcePlayerId,names:[...identity.names].sort(),positions:[...identity.positions].sort(),reason:'PROVIDER_POSITION_CONFLICT'});continue}
    const position=[...identity.positions][0],candidateMap=new Map();
    for(const name of identity.names)for(const player of current.get(`${normalizeName(name)}|${position}`)||[])candidateMap.set(String(player.id),player);
    if(candidateMap.size>1){ambiguous.push({sourcePlayerId:identity.sourcePlayerId,names:[...identity.names].sort(),position,candidates:[...candidateMap.keys()].sort(),reason:'AMBIGUOUS_CURRENT_CANONICAL_MATCH'});continue}
    const player=[...candidateMap.values()][0]||null;
    mappings.push(Object.freeze({
      canonicalPlayerId:player?String(player.id):`fhq_hist_ffc_${identity.sourcePlayerId}`,
      currentCanonicalPlayerId:player?String(player.id):null,
      identityScope:player?'PRODUCTION_CANONICAL':'RESEARCH_HISTORICAL',
      displayName:clean(player?.name)||[...identity.names].sort()[0],position,
      providerIds:Object.freeze({fantasyFootballCalculator:identity.sourcePlayerId}),
      sourceNames:Object.freeze([...identity.names].sort()),seasons:Object.freeze([...identity.seasons].sort()),
      matchMethod:player?'unique-normalized-name-position':'stable-provider-id-research-identity',
      matchConfidence:'HIGH',
    }));
  }
  return Object.freeze({mappings:Object.freeze(mappings),ambiguous:Object.freeze(ambiguous),quarantined:Object.freeze(quarantined)});
}

function adpRound(adp,leagueSize){
  const pick=finite(adp),teams=finite(leagueSize);
  if(pick===null||pick<=0||!Number.isInteger(teams)||teams<=0)throw new TypeError('positive ADP and integer league size are required');
  return Math.ceil(pick/teams);
}

function percentileFromOrdinal(ordinal,total){
  if(!Number.isInteger(ordinal)||ordinal<1||!Number.isInteger(total)||total<1||ordinal>total)throw new TypeError('valid ordinal and population size are required');
  return total===1?1:1-(ordinal-1)/(total-1);
}

function normalizeSnapshot(rawSnapshot,players=[]){
  if(rawSnapshot.providerKey!==PROVIDER_KEY||!Array.isArray(rawSnapshot.seasons))throw new TypeError('Fantasy Football Calculator source snapshot is required');
  const reconciliation=reconcileIdentities(rawSnapshot,players),mappingByProvider=new Map(reconciliation.mappings.map(row=>[row.providerIds.fantasyFootballCalculator,row])),ambiguousIds=new Set(reconciliation.ambiguous.map(row=>row.sourcePlayerId)),quarantined=[...reconciliation.quarantined],excluded=[],records=[],seasonMetadata=[];
  for(const sourceSeason of [...rawSnapshot.seasons].sort((a,b)=>a.requestedYear-b.requestedYear)){
    const season=Number(sourceSeason.requestedYear),meta=sourceSeason.meta||{};
    if(sourceSeason.status!=='Success'||meta.type!=='Half-PPR'||Number(meta.teams)!==12){quarantined.push({season,reason:'FORMAT_CONTRACT_MISMATCH',meta});continue}
    const eligible=(sourceSeason.players||[]).filter(row=>POSITIONS.includes(normalizePosition(row.position))&&!ambiguousIds.has(clean(row.player_id))&&mappingByProvider.has(clean(row.player_id))&&finite(row.adp)>0).sort((a,b)=>a.adp-b.adp||Number(a.player_id)-Number(b.player_id));
    const positionGroups=new Map();for(const row of eligible){const position=normalizePosition(row.position);if(!positionGroups.has(position))positionGroups.set(position,[]);positionGroups.get(position).push(row)}
    const positionRank=new Map();for(const [position,rows] of positionGroups)rows.forEach((row,index)=>positionRank.set(`${row.player_id}|${position}`,index+1));
    const canonicalSeen=new Map();
    eligible.forEach((row,index)=>{
      const sourcePlayerId=clean(row.player_id),mapping=mappingByProvider.get(sourcePlayerId),previous=canonicalSeen.get(mapping.canonicalPlayerId);
      if(previous&&previous!==sourcePlayerId){quarantined.push({season,sourcePlayerId,canonicalPlayerId:mapping.canonicalPlayerId,existingSourcePlayerId:previous,reason:'DUPLICATE_CANONICAL_ATTACHMENT'});return}canonicalSeen.set(mapping.canonicalPlayerId,sourcePlayerId);
      const position=normalizePosition(row.position),overallAdp=finite(row.adp),overallOrdinalRank=index+1;
      records.push(Object.freeze({recordType:'HISTORICAL_MARKET_COST',canonicalPlayerId:mapping.canonicalPlayerId,currentCanonicalPlayerId:mapping.currentCanonicalPlayerId,identityScope:mapping.identityScope,displayName:mapping.displayName,position,season,source:PROVIDER,sourcePlayerId,sourceName:clean(row.name),sourceTeam:clean(row.team),scoringFormat:'HALF_PPR',leagueSize:12,draftType:'REDRAFT',overallAdp,overallOrdinalRank,positionAdpRank:positionRank.get(`${sourcePlayerId}|${position}`),positionAdpBasis:'DERIVED_ORDINAL_FROM_OVERALL_ADP',adpRound:adpRound(overallAdp,12),marketCostPercentile:percentileFromOrdinal(overallOrdinalRank,eligible.length),timesDrafted:finite(row.times_drafted),standardDeviation:finite(row.stdev),highPick:finite(row.high),lowPick:finite(row.low),sourceWindow:Object.freeze({startDate:clean(meta.start_date),endDate:clean(meta.end_date),totalDrafts:finite(meta.total_drafts)}),matchMethod:mapping.matchMethod,matchConfidence:mapping.matchConfidence,providerIds:mapping.providerIds}));
    });
    for(const row of sourceSeason.players||[])if(!POSITIONS.includes(normalizePosition(row.position)))excluded.push({season,sourcePlayerId:clean(row.player_id),position:normalizePosition(row.position),reason:'OUT_OF_SCOPE_POSITION'});
    seasonMetadata.push(Object.freeze({season,scoringFormat:'HALF_PPR',leagueSize:12,draftType:'REDRAFT',sourceStartDate:clean(meta.start_date),sourceEndDate:clean(meta.end_date),totalDrafts:finite(meta.total_drafts),sourceRows:(sourceSeason.players||[]).length,normalizedRows:records.filter(row=>row.season===season).length}));
  }
  const providerIds=reconciliation.mappings.map(row=>row.providerIds.fantasyFootballCalculator),canonicalIds=reconciliation.mappings.map(row=>row.canonicalPlayerId);
  return Object.freeze({schemaVersion:1,milestone:'Jōnin 4.3.16',provider:PROVIDER,providerKey:PROVIDER_KEY,sourceUrlTemplate:rawSnapshot.sourceUrlTemplate,retrievedAt:rawSnapshot.retrievedAt,recommendationAuthority:false,formatContract:Object.freeze({scoringFormat:'HALF_PPR',leagueSize:12,draftType:'REDRAFT'}),seasonMetadata:Object.freeze(seasonMetadata),identities:Object.freeze(reconciliation.mappings),records:Object.freeze(records),coverage:Object.freeze({sourceRows:(rawSnapshot.seasons||[]).reduce((sum,item)=>sum+(item.players||[]).length,0),normalizedRecords:records.length,historicalPlayers:reconciliation.mappings.length,currentCanonicalPlayers:reconciliation.mappings.filter(row=>row.identityScope==='PRODUCTION_CANONICAL').length,historicalOnlyPlayers:reconciliation.mappings.filter(row=>row.identityScope==='RESEARCH_HISTORICAL').length,ambiguous:reconciliation.ambiguous.length,quarantined:quarantined.length,excluded:excluded.length,duplicateProviderIds:providerIds.length-new Set(providerIds).size,duplicateCanonicalAttachments:canonicalIds.length-new Set(canonicalIds).size}),ambiguous:reconciliation.ambiguous,quarantined:Object.freeze(quarantined),excluded:Object.freeze(excluded)});
}

function appreciationClass(adpGain){
  const gain=finite(adpGain);if(gain===null)throw new TypeError('ADP gain is required');
  return OUTCOME_CLASSES.find(row=>gain>=row.minimumAdpGain).label;
}

function buildTransitions(snapshot={}){
  const byIdentity=new Map();for(const record of snapshot.records||[]){if(!byIdentity.has(record.canonicalPlayerId))byIdentity.set(record.canonicalPlayerId,new Map());byIdentity.get(record.canonicalPlayerId).set(record.season,record)}
  const transitions=[];
  for(const [canonicalPlayerId,seasons] of byIdentity)for(const evidence of seasons.values()){
    const outcome=seasons.get(evidence.season+1);if(!outcome)continue;
    const adpGain=evidence.overallAdp-outcome.overallAdp,marketPercentileGain=outcome.marketCostPercentile-evidence.marketCostPercentile,roundGain=evidence.adpRound-outcome.adpRound,positionAdpGain=evidence.positionAdpRank-outcome.positionAdpRank;
    transitions.push(Object.freeze({recordType:'MARKET_VALUE_APPRECIATION',canonicalPlayerId,currentCanonicalPlayerId:evidence.currentCanonicalPlayerId,identityScope:evidence.identityScope,displayName:evidence.displayName,position:evidence.position,evidenceSeason:evidence.season,outcomeSeason:outcome.season,evidence:Object.freeze({overallAdp:evidence.overallAdp,overallOrdinalRank:evidence.overallOrdinalRank,positionAdpRank:evidence.positionAdpRank,adpRound:evidence.adpRound,marketCostPercentile:evidence.marketCostPercentile,sourceWindow:evidence.sourceWindow}),outcome:Object.freeze({overallAdp:outcome.overallAdp,overallOrdinalRank:outcome.overallOrdinalRank,positionAdpRank:outcome.positionAdpRank,adpRound:outcome.adpRound,marketCostPercentile:outcome.marketCostPercentile,sourceWindow:outcome.sourceWindow}),adpGain,positionAdpGain,roundGain,marketPercentileGain,appreciationClass:appreciationClass(adpGain),isAppreciation:adpGain>=24,source:PROVIDER,scoringFormat:'HALF_PPR',leagueSize:12,draftType:'REDRAFT'}));
  }
  return Object.freeze(transitions.sort((a,b)=>a.evidenceSeason-b.evidenceSeason||a.position.localeCompare(b.position)||a.evidence.overallAdp-b.evidence.overallAdp||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)));
}

module.exports=Object.freeze({PROVIDER,PROVIDER_KEY,POSITIONS,OUTCOME_CLASSES,normalizeName,normalizePosition,canonicalIndex,sourceIdentityUniverse,reconcileIdentities,adpRound,percentileFromOrdinal,normalizeSnapshot,appreciationClass,buildTransitions});
