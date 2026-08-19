'use strict';

const SleeperIdentity=require('../../sleeper-injury-adapter-v1.js');

const ENDPOINT=SleeperIdentity.ENDPOINT;
const CACHE_KEY='fantasyHQ.intelligence.sleeperPlayerContext.v1';
const REFRESH_MS=7*24*60*60*1000;
const clean=value=>String(value??'').trim();
const iso=value=>{const parsed=Date.parse(value);return Number.isFinite(parsed)?new Date(parsed).toISOString():null};
const optionalNumber=(value,{min=0,max=Number.MAX_SAFE_INTEGER,integer=false}={})=>{
  if(value===undefined||value===null||clean(value)==='')return{value:null,valid:true};
  const number=Number(value),valid=Number.isFinite(number)&&number>=min&&number<=max&&(!integer||Number.isInteger(number));
  return{value:valid?number:null,valid};
};

function contextRecord(sourcePlayer,reconciliation,fetchedAt){
  const age=optionalNumber(sourcePlayer.age,{min:16,max:60});
  const experience=optionalNumber(sourcePlayer.years_exp??sourcePlayer.years_experience,{min:0,max:30,integer:true});
  const depthOrder=optionalNumber(sourcePlayer.depth_chart_order,{min:1,max:20,integer:true});
  const issues=[];
  if(!age.valid)issues.push('INVALID_AGE');
  if(!experience.valid)issues.push('INVALID_EXPERIENCE');
  if(!depthOrder.valid)issues.push('INVALID_DEPTH_CHART_ORDER');
  return Object.freeze({
    canonicalPlayerId:String(reconciliation.player.id),
    source:'Sleeper',
    sourcePlayerId:clean(sourcePlayer.player_id),
    snapshotDate:iso(fetchedAt),
    season:2026,
    matchStatus:'MATCHED',
    matchConfidence:reconciliation.method==='stable-sleeper-id'?'HIGH':'MEDIUM',
    identityMethod:reconciliation.method,
    age:age.value,
    experience:experience.value,
    depthChartPosition:clean(sourcePlayer.depth_chart_position)||null,
    depthChartOrder:depthOrder.value,
    sourceStatus:clean(sourcePlayer.status)||null,
    sourceTeam:clean(sourcePlayer.team)||null,
    sourcePosition:SleeperIdentity.normalizePosition(sourcePlayer.position||sourcePlayer.fantasy_positions?.[0])||null,
    canonicalTeam:clean(reconciliation.player.team)||null,
    canonicalPosition:SleeperIdentity.normalizePosition(reconciliation.player.pos||reconciliation.player.position)||null,
    dataQuality:Object.freeze({valid:issues.length===0,issues:Object.freeze(issues)}),
    provenance:Object.freeze({adapter:'SleeperPlayerContextAdapterV1',endpoint:ENDPOINT,fetchedAt:iso(fetchedAt)}),
  });
}

function normalizeSnapshot(payload,canonicalPlayers,{fetchedAt=new Date().toISOString()}={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Object.keys(payload).length)throw new Error('Sleeper returned an empty or invalid player map.');
  const index=SleeperIdentity.buildCanonicalIndex(canonicalPlayers),records=[],unmatched=[],ambiguous=[],quarantined=[];
  const canonicalSourceCounts=new Map();
  canonicalPlayers.forEach(player=>{const id=clean(player.sleeperId||player.sleeper_id||player.externalIds?.sleeper);if(id)canonicalSourceCounts.set(id,(canonicalSourceCounts.get(id)||0)+1)});
  const conflictingCanonicalSourceIds=new Set([...canonicalSourceCounts].filter(([,count])=>count>1).map(([id])=>id));
  const sourceIds=new Set(),canonicalIds=new Set();
  Object.entries(payload).forEach(([key,value])=>{
    const sourcePlayer={...(value||{}),player_id:value?.player_id||key};
    const sourcePlayerId=clean(sourcePlayer.player_id);
    const position=SleeperIdentity.normalizePosition(sourcePlayer.position||sourcePlayer.fantasy_positions?.[0]);
    if(!sourcePlayerId||!['QB','RB','WR','TE','K','DST'].includes(position))return;
    if(sourceIds.has(sourcePlayerId)){quarantined.push({sourcePlayerId,reason:'DUPLICATE_SOURCE_ID'});return}
    sourceIds.add(sourcePlayerId);
    if(conflictingCanonicalSourceIds.has(sourcePlayerId)){quarantined.push({sourcePlayerId,reason:'CONFLICTING_CANONICAL_SOURCE_ID'});return}
    const reconciliation=SleeperIdentity.reconcile(sourcePlayer,index);
    if(reconciliation.status!=='MATCHED'){
      const row={sourcePlayerId,name:reconciliation.name,position,sourceTeam:clean(sourcePlayer.team),reason:reconciliation.status,candidates:reconciliation.candidates||[]};
      (reconciliation.status==='AMBIGUOUS'?ambiguous:unmatched).push(row);return;
    }
    const canonicalPlayerId=String(reconciliation.player.id);
    if(canonicalIds.has(canonicalPlayerId)){quarantined.push({sourcePlayerId,canonicalPlayerId,reason:'DUPLICATE_CANONICAL_ATTACHMENT'});return}
    canonicalIds.add(canonicalPlayerId);
    records.push(contextRecord(sourcePlayer,reconciliation,fetchedAt));
  });
  if(!records.length)throw new Error('Sleeper response produced zero safe canonical context matches; previous data was preserved.');
  return Object.freeze({schemaVersion:1,provider:'Sleeper',endpoint:ENDPOINT,season:2026,fetchedAt:iso(fetchedAt),refreshCadence:'weekly',records:Object.freeze(records),matched:records.length,unmatched:Object.freeze(unmatched),ambiguous:Object.freeze(ambiguous),quarantined:Object.freeze(quarantined),unmatchedCount:unmatched.length,ambiguousCount:ambiguous.length,quarantinedCount:quarantined.length});
}

function parseCached(storage){try{const raw=storage?.getItem(CACHE_KEY),snapshot=raw?JSON.parse(raw):null;return snapshot&&Array.isArray(snapshot.records)&&snapshot.records.length?snapshot:null}catch{return null}}
function isFresh(snapshot,now=new Date().toISOString()){const fetched=Date.parse(snapshot?.fetchedAt),current=Date.parse(now);return snapshot?.cacheState!=='STALE'&&Number.isFinite(fetched)&&Number.isFinite(current)&&current>=fetched&&current-fetched<=REFRESH_MS}
function staleCopy(snapshot,error,now){return snapshot?{...snapshot,cacheState:'STALE',refreshError:clean(error?.message||error),refreshFailedAt:iso(now),records:(snapshot.records||[]).map(record=>({...record,freshness:'STALE'}))}:null}
function createManager({fetchFn=globalThis.fetch?.bind(globalThis),storage=globalThis.localStorage,now=()=>new Date().toISOString()}={}){
  async function refresh(canonicalPlayers,{force=true}={}){
    const previous=parseCached(storage);
    if(!force&&isFresh(previous,now()))return{snapshot:previous,source:'cache',refreshed:false};
    try{
      if(typeof fetchFn!=='function')throw new Error('No network fetch implementation is available.');
      const response=await fetchFn(ENDPOINT,{cache:'no-store',headers:{accept:'application/json'}});
      if(!response?.ok)throw new Error(`Sleeper request failed with HTTP ${response?.status??'unknown'}.`);
      const snapshot=normalizeSnapshot(await response.json(),canonicalPlayers,{fetchedAt:now()});
      storage?.setItem(CACHE_KEY,JSON.stringify(snapshot));
      return{snapshot,source:'network',refreshed:true};
    }catch(error){
      const stale=staleCopy(previous,error,now());
      if(stale)storage?.setItem(CACHE_KEY,JSON.stringify(stale));
      return{snapshot:stale,source:previous?'stale-cache':'none',refreshed:false,error};
    }
  }
  return Object.freeze({loadCached:()=>parseCached(storage),refreshNow:players=>refresh(players,{force:true}),refreshScheduled:players=>refresh(players,{force:false})});
}

module.exports=Object.freeze({ENDPOINT,CACHE_KEY,REFRESH_MS,optionalNumber,contextRecord,normalizeSnapshot,isFresh,createManager});
