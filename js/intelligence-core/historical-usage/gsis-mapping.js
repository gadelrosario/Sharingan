'use strict';

const Identity=require('../../sleeper-injury-adapter-v1.js');
const SOURCE='nflverse';
const clean=value=>String(value??'').trim();
const team=value=>{const token=clean(value).toUpperCase();return({JAC:'JAX',LA:'LAR',STL:'LAR',SD:'LAC',OAK:'LV',WSH:'WAS'}[token]||token)};
const position=value=>Identity.normalizePosition(value);
const name=value=>Identity.normalizeName(value);
const canonicalId=player=>clean(player.id??player.canonicalPlayerId??player.playerId);
const canonicalKey=player=>clean(player.canonicalKey)||`${name(player.name)}-${position(player.pos||player.position).toLowerCase()}`;
const gsisId=row=>clean(row.gsis_id||row.gsisId||row.player_id);
const sourceName=row=>clean(row.display_name||row.player_display_name||row.player_name||row.full_name)||[row.first_name,row.last_name].map(clean).filter(Boolean).join(' ');
const sourcePosition=row=>position(row.position_group||row.position||row.ngs_position);
const sourceTeam=row=>team(row.latest_team||row.team||row.current_team);
const EXTERNAL_BRIDGES=Object.freeze({sleeper:['sleeper_id','sleeperId'],espn:['espn_id','espnId'],pfr:['pfr_id','pfrId'],yahoo:['yahoo_id','yahooId'],nfl:['nfl_id','nflId'],gsisIt:['gsis_it_id','gsisItId']});

function aliases(player={}){return [...new Set([player.name,...(player.identityAliases||[]),...(player.aliases||[]),...(player.legacyNames||[])].map(name).filter(Boolean))]}
function buildCanonicalIndex(players=[]){
  const byGsis=new Map(),duplicateGsis=new Set(),byExternal=new Map(),byIdentity=new Map();
  players.forEach(player=>{
    const external=player.externalIds||{},id=clean(external.gsis||external.nflverse||player.gsisId||player.nflverseId);
    if(id){if(byGsis.has(id))duplicateGsis.add(id);else byGsis.set(id,player)}
    Object.keys(EXTERNAL_BRIDGES).forEach(provider=>{const value=clean(external[provider]||player[`${provider}Id`]);if(!value)return;const key=`${provider}|${value}`;if(!byExternal.has(key))byExternal.set(key,[]);byExternal.get(key).push(player)});
    aliases(player).forEach(normalized=>{const key=`${normalized}|${position(player.pos||player.position)}|${team(player.team)}`;if(!byIdentity.has(key))byIdentity.set(key,[]);byIdentity.get(key).push(player)});
  });
  duplicateGsis.forEach(id=>byGsis.delete(id));
  return{byGsis,duplicateGsis,byExternal,byIdentity};
}
function bridgeCandidates(row,index){
  const matches=[];
  Object.entries(EXTERNAL_BRIDGES).forEach(([provider,fields])=>{const value=clean(fields.map(field=>row[field]).find(clean));if(!value)return;(index.byExternal.get(`${provider}|${value}`)||[]).forEach(player=>matches.push({player,provider,value}))});
  const unique=new Map(matches.map(match=>[canonicalId(match.player),match]));
  return [...unique.values()];
}
function conflicts(row,player){
  const sourcePos=sourcePosition(row),canonicalPos=position(player.pos||player.position),sourceNflTeam=sourceTeam(row),canonicalTeam=team(player.team);
  if(sourcePos&&canonicalPos&&sourcePos!==canonicalPos)return'POSITION_CONFLICT';
  if(sourceNflTeam&&canonicalTeam&&sourceNflTeam!==canonicalTeam)return'TEAM_CONFLICT';
  return null;
}
function reconcilePlayerRows(rows=[],players=[],{snapshotDate=new Date().toISOString()}={}){
  if(!Array.isArray(rows)||!Array.isArray(players))throw new TypeError('mapping rows and canonical players must be arrays');
  const index=buildCanonicalIndex(players),mappings=[],unmatched=[],ambiguous=[],quarantined=[],seenGsis=new Set(),canonicalAssignments=new Map();
  rows.forEach(row=>{
    const id=gsisId(row),displayName=sourceName(row),pos=sourcePosition(row),nflTeam=sourceTeam(row);
    if(!id){quarantined.push({reason:'MISSING_GSIS_ID',displayName,position:pos,team:nflTeam});return}
    if(seenGsis.has(id)){quarantined.push({gsisId:id,reason:'DUPLICATE_GSIS_ID'});return}seenGsis.add(id);
    if(index.duplicateGsis.has(id)){ambiguous.push({gsisId:id,reason:'GSIS_ID_ON_MULTIPLE_CANONICAL_PLAYERS'});return}
    let player=index.byGsis.get(id),method='exact-known-gsis-id',confidence='HIGH';
    if(!player){const bridges=bridgeCandidates(row,index);if(bridges.length===1){player=bridges[0].player;method=`external-id-bridge:${bridges[0].provider}`;confidence='HIGH'}else if(bridges.length>1){ambiguous.push({gsisId:id,reason:'AMBIGUOUS_EXTERNAL_ID_BRIDGE',candidates:bridges.map(item=>canonicalId(item.player))});return}}
    if(!player&&displayName&&pos&&nflTeam){const candidates=index.byIdentity.get(`${name(displayName)}|${pos}|${nflTeam}`)||[];if(candidates.length===1){player=candidates[0];method=aliases(candidates[0]).includes(name(displayName))&&name(candidates[0].name)!==name(displayName)?'canonical-alias-position-team':'unique-normalized-name-position-team';confidence='MEDIUM'}else if(candidates.length>1){ambiguous.push({gsisId:id,reason:'AMBIGUOUS_NAME_POSITION_TEAM',candidates:candidates.map(canonicalId)});return}}
    if(!player){unmatched.push({gsisId:id,displayName,position:pos,team:nflTeam,reason:'NO_SAFE_CANONICAL_MATCH'});return}
    const conflict=conflicts(row,player);if(conflict){quarantined.push({gsisId:id,canonicalPlayerId:canonicalId(player),reason:conflict,sourcePosition:pos,canonicalPosition:position(player.pos||player.position),sourceTeam:nflTeam,canonicalTeam:team(player.team)});return}
    const cid=canonicalId(player),previous=canonicalAssignments.get(cid);if(previous&&previous!==id){quarantined.push({gsisId:id,canonicalPlayerId:cid,existingGsisId:previous,reason:'DUPLICATE_CANONICAL_ATTACHMENT'});return}canonicalAssignments.set(cid,id);
    mappings.push(Object.freeze({canonicalPlayerId:cid,canonicalKey:canonicalKey(player),displayName:clean(player.name),position:position(player.pos||player.position),team:team(player.team),gsisId:id,source:SOURCE,sourceSnapshotDate:new Date(snapshotDate).toISOString(),matchMethod:method,matchConfidence:confidence,reviewStatus:confidence==='HIGH'?'AUTO_VERIFIED':'REVIEWABLE_HIGH_CONFIDENCE'}));
  });
  return Object.freeze({schemaVersion:1,source:SOURCE,sourceSnapshotDate:new Date(snapshotDate).toISOString(),mappings:Object.freeze(mappings),mapped:mappings.length,unmatched:Object.freeze(unmatched),ambiguous:Object.freeze(ambiguous),quarantined:Object.freeze(quarantined),unmatchedCount:unmatched.length,ambiguousCount:ambiguous.length,quarantinedCount:quarantined.length});
}
function applyMappings(players=[],mappingSnapshot={}){const byId=new Map((mappingSnapshot.mappings||[]).map(item=>[String(item.canonicalPlayerId),item]));return players.map(player=>{const mapping=byId.get(canonicalId(player));if(!mapping)return player;return{...player,externalIds:{...(player.externalIds||{}),gsis:mapping.gsisId}}})}
function classifyHistory(players=[],mappingSnapshot={},historicalSnapshot={}){
  const mapped=new Map((mappingSnapshot.mappings||[]).map(item=>[String(item.canonicalPlayerId),item])),seasonsByPlayer=new Map();
  (historicalSnapshot.players||[]).forEach(record=>{const id=String(record.canonicalPlayerId);if(!seasonsByPlayer.has(id))seasonsByPlayer.set(id,new Set());seasonsByPlayer.get(id).add(Number(record.season))});
  return players.filter(player=>['QB','RB','WR','TE'].includes(position(player.pos||player.position))).map(player=>{const id=canonicalId(player),seasons=[...(seasonsByPlayer.get(id)||[])].sort(),rookie=player.rookie===true;return Object.freeze({canonicalPlayerId:id,displayName:clean(player.name),position:position(player.pos||player.position),mappedGsis:mapped.has(id),seasons:Object.freeze(seasons),historyStatus:seasons.length?'HISTORY_AVAILABLE':rookie?'NO_HISTORY_EXPECTED':'HISTORY_MISSING'})});
}
function buildResearchUniverse(playerRows=[],canonicalPlayers=[],mappingSnapshot={},statsRows=[]){
  const currentByGsis=new Map((mappingSnapshot.mappings||[]).map(item=>[clean(item.gsisId),item])),currentById=new Map(canonicalPlayers.map(player=>[canonicalId(player),player]));
  const statIdentity=new Map(),conflicts=[],quarantined=[];
  for(const row of statsRows){
    const id=clean(row.player_id||row.gsis_id),pos=position(row.position),displayName=clean(row.player_display_name||row.player_name);
    if(!id||!['QB','RB','WR','TE'].includes(pos))continue;
    const prior=statIdentity.get(id);
    if(prior&&prior.position!==pos){conflicts.push(Object.freeze({gsisId:id,positions:Object.freeze([prior.position,pos].sort()),reason:'HISTORICAL_POSITION_CONFLICT'}));continue}
    if(!prior)statIdentity.set(id,{displayName,position:pos,seasons:new Set()});
    statIdentity.get(id).seasons.add(Number(row.season));
  }
  const playerByGsis=new Map();
  for(const row of playerRows){const id=gsisId(row);if(!id)continue;if(playerByGsis.has(id)){quarantined.push(Object.freeze({gsisId:id,reason:'DUPLICATE_PLAYER_SOURCE_ID'}));playerByGsis.delete(id);continue}playerByGsis.set(id,row)}
  const conflictIds=new Set(conflicts.map(item=>item.gsisId)),players=[],mappings=[];
  for(const [id,observed] of [...statIdentity].sort(([left],[right])=>left.localeCompare(right))){
    if(conflictIds.has(id))continue;
    const canonicalMapping=currentByGsis.get(id),canonical=canonicalMapping?currentById.get(String(canonicalMapping.canonicalPlayerId)):null,source=playerByGsis.get(id)||{};
    const canonicalPlayerId=canonical?canonicalId(canonical):`fhq_hist_gsis_${id.replace(/[^A-Za-z0-9]/g,'_')}`;
    const displayName=clean(canonical?.name)||sourceName(source)||observed.displayName||`Historical ${id}`;
    const pos=position(canonical?.pos||canonical?.position)||sourcePosition(source)||observed.position;
    const researchPlayer=Object.freeze({
      ...(canonical||{}),id:canonicalPlayerId,name:displayName,pos,position:pos,team:clean(canonical?.team)||sourceTeam(source)||null,
      identityScope:canonical?'PRODUCTION_CANONICAL':'RESEARCH_HISTORICAL',
      externalIds:Object.freeze({...((canonical?.externalIds)||{}),gsis:id}),
      sourceMetadata:Object.freeze({birthDate:clean(source.birth_date)||null,nflEntryYear:Number.isInteger(Number(source.draft_year))&&Number(source.draft_year)>0?Number(source.draft_year):null,rookieSeason:Number.isInteger(Number(source.rookie_season))&&Number(source.rookie_season)>0?Number(source.rookie_season):null,sourceDisplayName:sourceName(source)||observed.displayName||null}),
    });
    players.push(researchPlayer);
    mappings.push(Object.freeze({canonicalPlayerId,canonicalKey:canonicalKey(researchPlayer),displayName,position:pos,team:team(researchPlayer.team),gsisId:id,identityScope:researchPlayer.identityScope,source:SOURCE,sourceSnapshotDate:mappingSnapshot.sourceSnapshotDate||null,matchMethod:canonical?canonicalMapping.matchMethod:'stable-gsis-research-identity',matchConfidence:canonical?canonicalMapping.matchConfidence:'HIGH',seasons:Object.freeze([...observed.seasons].sort())}));
  }
  return Object.freeze({schemaVersion:1,source:SOURCE,recommendationAuthority:false,players:Object.freeze(players),mappings:Object.freeze(mappings),currentCanonicalPlayers:players.filter(player=>player.identityScope==='PRODUCTION_CANONICAL').length,historicalOnlyPlayers:players.filter(player=>player.identityScope==='RESEARCH_HISTORICAL').length,ambiguous:Object.freeze(conflicts),quarantined:Object.freeze(quarantined),duplicateCanonicalIds:players.length-new Set(players.map(player=>String(player.id))).size});
}
module.exports=Object.freeze({SOURCE,EXTERNAL_BRIDGES,team,position,name,aliases,buildCanonicalIndex,reconcilePlayerRows,applyMappings,classifyHistory,buildResearchUniverse});
