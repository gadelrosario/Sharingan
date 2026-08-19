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
module.exports=Object.freeze({SOURCE,EXTERNAL_BRIDGES,team,position,name,aliases,buildCanonicalIndex,reconcilePlayerRows,applyMappings,classifyHistory});
