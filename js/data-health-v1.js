(function(root){
  'use strict';
  const text=value=>String(value??'').trim();
  const normalizeName=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
  const normalizePosition=value=>{const position=text(value).toUpperCase().replace(/[^A-Z]/g,'');return ['DEF','DEFENSE','D'].includes(position)?'DST':position};
  function identityAudit(players=[],snapshot={}){
    const ids=new Map(),identities=new Map(),duplicateCanonicalIds=[],duplicateIdentities=[],blankTeams=[];
    players.forEach(player=>{const id=text(player.id),identity=`${normalizeName(player.name)}|${normalizePosition(player.pos||player.position)}`;if(ids.has(id))duplicateCanonicalIds.push(id);else ids.set(id,player);if(identities.has(identity))duplicateIdentities.push(identity);else identities.set(identity,player);if(!text(player.team)&&['QB','RB','WR','TE'].includes(normalizePosition(player.pos||player.position)))blankTeams.push(id)});
    const sourceIds=new Map(),duplicateSourceIds=[],unresolvedInjuryIds=[];
    for(const record of snapshot.records||[]){const playerId=text(record.playerId),sourceId=text(record.sourcePlayerId);if(!ids.has(playerId))unresolvedInjuryIds.push(playerId);if(sourceId){if(sourceIds.has(sourceId)&&sourceIds.get(sourceId)!==playerId)duplicateSourceIds.push(sourceId);else sourceIds.set(sourceId,playerId)}}
    return Object.freeze({totalPlayers:players.length,canonicalIds:ids.size,duplicateCanonicalIds:Object.freeze([...new Set(duplicateCanonicalIds)]),duplicateIdentities:Object.freeze([...new Set(duplicateIdentities)]),blankDraftableTeams:Object.freeze(blankTeams),injuryRecords:(snapshot.records||[]).length,unresolvedInjuryIds:Object.freeze([...new Set(unresolvedInjuryIds)]),duplicateSleeperIds:Object.freeze([...new Set(duplicateSourceIds)]),unmatchedSourceRows:Number(snapshot.unmatchedCount)||0,ambiguousSourceRows:Number(snapshot.ambiguousCount)||0,criticalIssues:duplicateCanonicalIds.length+duplicateIdentities.length+blankTeams.length+unresolvedInjuryIds.length+duplicateSourceIds.length+Number(snapshot.ambiguousCount||0)});
  }
  function injuryHealth(snapshot={},now=new Date().toISOString()){
    if(!snapshot||!Array.isArray(snapshot.records)||!snapshot.records.length)return Object.freeze({status:'UNAVAILABLE',fetchedAt:null,ageHours:null,label:'Injury data unavailable'});
    const fetched=Date.parse(snapshot.fetchedAt),current=Date.parse(now),ageHours=Number.isFinite(fetched)&&Number.isFinite(current)?Math.max(0,(current-fetched)/36e5):null,stale=snapshot.cacheState==='STALE'||ageHours===null||ageHours>24;
    return Object.freeze({status:stale?'STALE':'CURRENT',fetchedAt:Number.isFinite(fetched)?new Date(fetched).toISOString():null,ageHours:ageHours===null?null:Math.round(ageHours*10)/10,label:stale?'Injury data stale':'Injury data fresh'});
  }
  function summary({players=[],injurySnapshot={},rankingSnapshot=null,now}={}){const identity=identityAudit(players,injurySnapshot),injuries=injuryHealth(injurySnapshot,now);return Object.freeze({rankings:Object.freeze({source:text(rankingSnapshot?.source)||'Unavailable',snapshotDate:text(rankingSnapshot?.snapshotDate)||null}),injuries,playerPool:players.length,identityIssues:identity.criticalIssues,identity})}
  const api=Object.freeze({normalizeName,normalizePosition,identityAudit,injuryHealth,summary});root.DataHealthV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
