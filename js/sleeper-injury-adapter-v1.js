(function(root){
  'use strict';
  const ENDPOINT='https://api.sleeper.app/v1/players/nfl';
  const CACHE_KEY='fantasyHQ.injuries.sleeper.v1';
  const REFRESH_MS=24*60*60*1000;
  const POSITIONS=new Set(['QB','RB','WR','TE','K','DST']);
  const clean=value=>String(value??'').trim();
  const iso=value=>{const parsed=Date.parse(value);return Number.isFinite(parsed)?new Date(parsed).toISOString():null};
  const sourceTimestamp=(value,fallback)=>{const numeric=Number(value);if(Number.isFinite(numeric)&&numeric>0)return new Date(numeric<1e12?numeric*1000:numeric).toISOString();return iso(value)||iso(fallback)};
  const normalizeName=value=>clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
  const normalizePosition=value=>{const pos=clean(value).toUpperCase().replace(/[^A-Z]/g,'');return ['DEF','DEFENSE','D'].includes(pos)?'DST':pos};
  function sourceName(player={}){return clean(player.full_name)||[player.first_name,player.last_name].map(clean).filter(Boolean).join(' ')}
  function canonicalExternalId(player={}){return clean(player.sleeperId||player.sleeper_id||player.externalIds?.sleeper)}
  function buildCanonicalIndex(players=[]){
    const bySleeper=new Map(),byIdentity=new Map();
    players.forEach(player=>{const external=canonicalExternalId(player);if(external)bySleeper.set(external,player);const key=`${normalizeName(player.name)}|${normalizePosition(player.pos||player.position)}`;if(!byIdentity.has(key))byIdentity.set(key,[]);byIdentity.get(key).push(player)});
    return {bySleeper,byIdentity};
  }
  function reconcile(sourcePlayer={},index){
    const sourcePlayerId=clean(sourcePlayer.player_id),position=normalizePosition(sourcePlayer.position||sourcePlayer.fantasy_positions?.[0]),name=sourceName(sourcePlayer);
    if(sourcePlayerId&&index.bySleeper.has(sourcePlayerId))return{status:'MATCHED',method:'stable-sleeper-id',player:index.bySleeper.get(sourcePlayerId),sourcePlayerId,name,position};
    const candidates=index.byIdentity.get(`${normalizeName(name)}|${position}`)||[];
    if(candidates.length===1)return{status:'MATCHED',method:'exact-normalized-name-position',player:candidates[0],sourcePlayerId,name,position};
    return{status:candidates.length?'AMBIGUOUS':'UNMATCHED',method:null,candidates:candidates.map(player=>player.id),sourcePlayerId,name,position};
  }
  function normalizeSleeperStatus(player={}){
    const injuryRaw=clean(player.injury_status),rosterRaw=clean(player.status),practiceRaw=clean(player.practice_participation),injury=injuryRaw.toUpperCase(),roster=rosterRaw.toUpperCase(),practice=practiceRaw.toUpperCase(),raw=injuryRaw||rosterRaw||practiceRaw;
    if(/PUP|PHYSICALLY UNABLE/.test(injury)||/PUP|PHYSICALLY UNABLE/.test(roster))return{status:'PUP',raw};
    if(/NFI|NON.FOOTBALL/.test(injury)||/NFI|NON.FOOTBALL/.test(roster))return{status:'NFI',raw};
    if(/INJURED RESERVE|\bIR\b/.test(injury)||/INJURED RESERVE|\bIR\b/.test(roster))return{status:'IR',raw};
    if(/SUSPEND/.test(injury)||/SUSPEND/.test(roster))return{status:'SUSPENDED',raw};
    if(/OUT/.test(injury))return{status:'OUT',raw};
    if(/DOUBTFUL/.test(injury))return{status:'DOUBTFUL',raw};
    if(/QUESTIONABLE|GAME.TIME/.test(injury))return{status:'QUESTIONABLE',raw};
    if(/LIMIT/.test(injury)||/LIMIT/.test(practice))return{status:'LIMITED',raw};
    if(['INACTIVE','UNAVAILABLE'].includes(roster))return{status:'UNAVAILABLE',raw};
    if(roster==='ACTIVE'&&!injury)return{status:'ACTIVE',raw:roster};
    return{status:'UNKNOWN',raw};
  }
  function sourceReport(player,fetchedAt){
    const normalized=normalizeSleeperStatus(player),reportedAt=sourceTimestamp(player.news_updated||player.injury_start_date,fetchedAt);
    return Object.freeze({provider:'Sleeper',sourcePlayerId:clean(player.player_id),sourceTeam:clean(player.team),rawStatus:normalized.raw,normalizedStatus:normalized.status,reportedAt,fetchedAt:iso(fetchedAt),reliability:'platform',injuryType:clean(player.injury_notes),bodyPart:clean(player.injury_body_part),practiceParticipation:clean(player.practice_participation),url:ENDPOINT});
  }
  function mergeReports(primary,supplemental=[]){
    const reports=[primary,...supplemental].filter(Boolean),rank=report=>({official:100,practice:90,'beat-reporter':75,platform:70,analyst:55,unverified:20}[report.reliability]||20),fresh=report=>Date.parse(report.reportedAt||report.fetchedAt)||0;
    const ordered=[...reports].sort((a,b)=>fresh(b)-fresh(a)||rank(b)-rank(a)||(a.provider==='Sleeper'?-1:1)),known=ordered.filter(report=>report.normalizedStatus&&report.normalizedStatus!=='UNKNOWN'),selected=known[0]||ordered[0]||primary,statuses=[...new Set(known.map(report=>report.normalizedStatus))],sourceDisagreement=statuses.length>1;
    return{selected,reports,sourceDisagreement,disagreement:sourceDisagreement?{statuses,providers:known.map(report=>({provider:report.provider,status:report.normalizedStatus,reportedAt:report.reportedAt}))}:null};
  }
  function toRecord(sourcePlayer,reconciliation,fetchedAt,previousRecord,supplemental=[]){
    const primary=sourceReport(sourcePlayer,fetchedAt),merged=mergeReports(primary,supplemental),selected=merged.selected,previousStatus=clean(previousRecord?.status),history=[...(previousRecord?.history||[])];
    if(previousStatus&&previousStatus!==selected.normalizedStatus)history.push({at:iso(fetchedAt),changes:{status:{from:previousStatus,to:selected.normalizedStatus}},source:selected.provider});
    return{playerId:String(reconciliation.player.id),status:selected.normalizedStatus,sourcePlayerId:primary.sourcePlayerId,sourceTeam:primary.sourceTeam,canonicalTeam:clean(reconciliation.player.team),rawSourceStatus:primary.rawStatus,injuryType:selected.injuryType||'',bodyPart:selected.bodyPart||'',practiceStatus:selected.practiceParticipation||'',lastUpdated:selected.reportedAt||iso(fetchedAt),expectedAvailability:'',expectedAvailabilityExplicit:false,sources:merged.reports.map(report=>({provider:report.provider,url:report.url,sourcePlayerId:report.sourcePlayerId,sourceTeam:report.sourceTeam,reportedAt:report.reportedAt,fetchedAt:report.fetchedAt,reliability:report.reliability,rawStatus:report.rawStatus,note:report.note||''})),sourceReports:merged.reports,sourceDisagreement:merged.sourceDisagreement,disagreement:merged.disagreement,history,provenance:{adapter:'SleeperInjuryAdapterV1',identityMethod:reconciliation.method,fetchedAt:iso(fetchedAt),endpoint:ENDPOINT}};
  }
  function normalizeSnapshot(payload,canonicalPlayers,{fetchedAt=new Date().toISOString(),previousSnapshot=null,supplementalReports=[]}={}){
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Object.keys(payload).length)throw new Error('Sleeper returned an empty or invalid player map.');
    const index=buildCanonicalIndex(canonicalPlayers),previous=new Map((previousSnapshot?.records||[]).map(record=>[String(record.playerId),record])),supplementalByPlayer=new Map();
    supplementalReports.forEach(report=>{const key=String(report.playerId);if(!supplementalByPlayer.has(key))supplementalByPlayer.set(key,[]);supplementalByPlayer.get(key).push(report)});
    const records=[],unmatched=[],ambiguous=[];let eligibleSourceRows=0;
    Object.entries(payload).forEach(([key,value])=>{const sourcePlayer={...value,player_id:value?.player_id||key},position=normalizePosition(sourcePlayer.position||sourcePlayer.fantasy_positions?.[0]);if(!POSITIONS.has(position)||!sourceName(sourcePlayer))return;eligibleSourceRows++;const result=reconcile(sourcePlayer,index);if(result.status==='MATCHED'){records.push(toRecord(sourcePlayer,result,fetchedAt,previous.get(String(result.player.id)),supplementalByPlayer.get(String(result.player.id))||[]))}else{const item={sourcePlayerId:result.sourcePlayerId,name:result.name,position:result.position,sourceTeam:clean(sourcePlayer.team),reason:result.status,candidates:result.candidates||[]};(result.status==='AMBIGUOUS'?ambiguous:unmatched).push(item)}});
    if(!records.length)throw new Error('Sleeper response produced zero safe canonical matches; previous data was preserved.');
    return{schemaVersion:1,season:2026,provider:'Sleeper',endpoint:ENDPOINT,fetchedAt:iso(fetchedAt),refreshCadence:'daily',sourceRows:Object.keys(payload).length,eligibleSourceRows,records,matched:records.length,unmatchedCount:unmatched.length,ambiguousCount:ambiguous.length,unmatched,ambiguous};
  }
  function parseCached(storage){try{const value=storage?.getItem(CACHE_KEY);return value?JSON.parse(value):null}catch{return null}}
  function isFresh(snapshot,now=new Date().toISOString()){const fetched=Date.parse(snapshot?.fetchedAt),current=Date.parse(now);return snapshot?.cacheState!=='STALE'&&Number.isFinite(fetched)&&Number.isFinite(current)&&current>=fetched&&current-fetched<=REFRESH_MS}
  function staleCopy(snapshot,error,now){return snapshot?{...snapshot,cacheState:'STALE',refreshError:clean(error?.message||error),refreshFailedAt:iso(now),records:(snapshot.records||[]).map(record=>({...record,feedStale:true}))}:null}
  function createManager({fetchFn=root.fetch?.bind(root),storage=root.localStorage,now=()=>new Date().toISOString()}={}){
    async function refresh(canonicalPlayers,{force=true,supplementalReports=[]}={}){const previous=parseCached(storage);if(!force&&isFresh(previous,now()))return{snapshot:previous,source:'cache',refreshed:false};try{if(typeof fetchFn!=='function')throw new Error('No network fetch implementation is available.');const response=await fetchFn(ENDPOINT,{cache:'no-store'});if(!response?.ok)throw new Error(`Sleeper request failed with HTTP ${response?.status??'unknown'}.`);const snapshot=normalizeSnapshot(await response.json(),canonicalPlayers,{fetchedAt:now(),previousSnapshot:previous,supplementalReports});storage?.setItem(CACHE_KEY,JSON.stringify(snapshot));return{snapshot,source:'network',refreshed:true}}catch(error){const stale=staleCopy(previous,error,now());if(stale)storage?.setItem(CACHE_KEY,JSON.stringify(stale));return{snapshot:stale,source:previous?'stale-cache':'none',refreshed:false,error}}}
    return Object.freeze({loadCached:()=>parseCached(storage),refreshNow:(players,options={})=>refresh(players,{...options,force:true}),refreshDaily:(players,options={})=>refresh(players,{...options,force:false})});
  }
  const api=Object.freeze({ENDPOINT,CACHE_KEY,REFRESH_MS,normalizeName,normalizePosition,buildCanonicalIndex,reconcile,normalizeSleeperStatus,sourceReport,mergeReports,normalizeSnapshot,isFresh,createManager});root.SleeperInjuryAdapterV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
