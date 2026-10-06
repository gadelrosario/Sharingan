/* NBA category evidence only. No forecasts, ratings or automatic name joins. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FantasyHQNBASeasonV1=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const categories={MIN:'minutes',PTS:'points',REB:'rebounds',AST:'assists',ST:'steals',STL:'steals',BLK:'blocks',TO:'turnovers','3PTM':'threePointersMade','3PM':'threePointersMade',FGM:'fieldGoalsMade',FGA:'fieldGoalsAttempted',FTM:'freeThrowsMade',FTA:'freeThrowsAttempted'};
  const fields=[...new Set(Object.values(categories))];
  function categoryMap(settings){return settings.categories.filter(c=>c.enabled&&!c.displayOnly).map(c=>({...c,status:categories[c.label]?'SUPPORTED':['FG%','FT%'].includes(c.label)?'DERIVABLE':'UNSUPPORTED',field:categories[c.label]||null}));}
  function aggregate(envelope){
    if(envelope?.refresh?.status!=='SUCCESS'||!envelope.snapshot?.metadata?.source||!envelope.snapshot?.metadata?.retrievedAt)return [];
    const snapshot=envelope.snapshot,groups=new Map(),seen=new Set();
    for(const row of snapshot.records||[]){
      if(row.canonicalPlayerId!==`nba:espn:${row.providerPlayerId}`||!/^\d+$/.test(row.providerPlayerId)||row.provider!=='espn')throw Error('Invalid ESPN identity');
      const key=`${row.providerGameId}:${row.providerPlayerId}`;if(seen.has(key))throw Error('Duplicate observation');seen.add(key);
      if(Number(row.season)!==Number(snapshot.metadata.sportsDataverseSeasonEndingYear))throw Error('Conflicting statistical season');
      const groupKey=`${row.canonicalPlayerId}:${row.seasonType}`,list=groups.get(groupKey)||[];list.push(row);groups.set(groupKey,list);
    }
    return [...groups.values()].map(rows=>{
      const played=rows.filter(r=>r.didPlay===true),values={};
      for(const field of fields){values[field]=played.length&&played.every(r=>typeof r[field]==='number'&&Number.isFinite(r[field])&&r[field]>=0)?played.reduce((n,r)=>n+r[field],0):null;}
      values['FG%']=values.fieldGoalsAttempted>0&&values.fieldGoalsMade!==null?values.fieldGoalsMade/values.fieldGoalsAttempted:null;
      values['FT%']=values.freeThrowsAttempted>0&&values.freeThrowsMade!==null?values.freeThrowsMade/values.freeThrowsAttempted:null;
      return {canonicalId:rows[0].canonicalPlayerId,providerIds:{espn:rows[0].providerPlayerId},name:rows[0].playerName,team:rows.at(-1).teamAbbreviation,seasonEndingYear:rows[0].season,seasonType:rows[0].seasonType,
        observations:rows.length,gamesPlayed:played.length,unknownParticipation:rows.filter(r=>r.didPlay===null).length,
        window:{from:rows.map(r=>r.gameDate).sort()[0],through:rows.map(r=>r.gameDate).sort().at(-1)},values,provenance:snapshot.metadata};
    });
  }
  // Yahoo labels the starting year; the source file labels the ending year.
  function seasonContext(settings){
    const year=Number(settings.season),start=settings.startDate,end=settings.endDate;
    const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
    if(settings.sport!=='nba'||!Number.isInteger(year)||!valid(start)||!valid(end)||!start.startsWith(year+'-')||!end.startsWith((year+1)+'-')||start>=end)throw Error('Unverified Yahoo NBA season dates');
    return {yahooSeason:year,endingYear:year+1,nbaSeason:`${year}–${String(year+1).slice(2)}`,startDate:start,endDate:end};
  }
  function currentEvidence(envelope,settings){
    const season=seasonContext(settings),snapshot=envelope?.snapshot;
    if(!snapshot||Number(snapshot.metadata?.sportsDataverseSeasonEndingYear)!==season.endingYear)return {season,status:'CURRENT-SEASON STATS NOT YET AVAILABLE',evidence:[]};
    // Season-mode evidence is the league's regular-season window only.
    const rows=snapshot.records||[];
    for(const r of rows){if(!/^\d{4}-\d{2}-\d{2}$/.test(r.gameDate||'')||!Number.isFinite(Date.parse(r.gameDate))||new Date(r.gameDate).toISOString().slice(0,10)!==r.gameDate||r.gameDate<`${season.yahooSeason}-07-01`||r.gameDate>`${season.endingYear}-06-30`)throw Error('Statistical date outside current NBA season');}
    const evidence=aggregate({...envelope,snapshot:{...snapshot,records:rows.filter(r=>String(r.seasonType)==='2'&&r.gameDate>=season.startDate&&r.gameDate<=season.endDate)}});
    return {season,status:evidence.length?'AVAILABLE':'CURRENT-SEASON STATS NOT YET AVAILABLE',evidence};
  }
  function reconcile(players,evidence){
    const espn=new Map(),conflicts=new Set();
    for(const row of evidence){
      const id=row.providerIds?.espn;
      if(!/^\d+$/.test(id||'')||row.canonicalId!==`nba:espn:${id}`)throw Error('Invalid crosswalk ESPN identity');
      const list=espn.get(id)||[];
      if(list.some(r=>r.name!==row.name||r.seasonType===row.seasonType))conflicts.add(id);
      list.push(row);espn.set(id,list);
    }
    const owners=new Map();for(const p of players){if(p.providerIds?.espn){const id=p.providerIds.espn,list=owners.get(id)||[];list.push(p.canonicalId);owners.set(id,list);}}
    const yahooCounts=new Map();players.forEach(p=>yahooCounts.set(p.canonicalId,(yahooCounts.get(p.canonicalId)||0)+1));
    const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return players.map(p=>{
      const id=p.providerIds?.espn,stats=id?espn.get(id):null;
      if(p.sport!=='nba'||p.canonicalId!==`nba:yahoo:${p.providerIds?.yahoo}`||yahooCounts.get(p.canonicalId)>1||(id&&(owners.get(id).length!==1||conflicts.has(id))))return {...p,statistics:null,mapping:'CONFLICT',mappingReason:'IDENTITY_CONFLICT'};
      if(stats)return {...p,statistics:stats,mapping:'DIRECT_ID',mappingBasis:'Explicit shared ESPN provider ID'};
      // Team/position/jersey are mutable. Existing sources lack a shared stable ID
      // or birth metadata and contemporaneous corroboration. No multi-field producer.
      const named=evidence.filter(r=>normalize(r.name)&&normalize(r.name)===normalize(p.name));
      const candidates=[...new Set(named.filter(r=>r.team&&r.team===p.team).map(r=>r.canonicalId))];
      const reason=!evidence.length?'NO_CURRENT_ESPN_UNIVERSE':id?'DIRECT_ID_NOT_IN_SOURCE':!named.length?'NO_ESPN_CANDIDATE':!candidates.length?'TEAM_MISMATCH':'INSUFFICIENT_CORROBORATION';
      return {...p,statistics:null,mapping:candidates.length>1?'CONFLICT':'UNRESOLVED',mappingReason:candidates.length>1?'MULTIPLE_CANDIDATES':reason,reconciliationCandidates:candidates,candidateAuthority:'REVIEW_ONLY'};
    });
  }
  return {categoryMap,aggregate,seasonContext,currentEvidence,reconcile};
});
