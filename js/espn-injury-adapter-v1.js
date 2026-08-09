(function(root){
  'use strict';
  // ESPN does not document a supported public NFL injury endpoint. This adapter is
  // deliberately opt-in so an internal endpoint can never become an app dependency.
  const DEFAULT_ENDPOINT='https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries';
  const clean=value=>String(value??'').trim();
  const status=value=>{const raw=clean(value).toUpperCase();if(/PUP|PHYSICALLY UNABLE/.test(raw))return'PUP';if(/NFI|NON.FOOTBALL/.test(raw))return'NFI';if(/INJURED RESERVE|\bIR\b/.test(raw))return'IR';if(/SUSPEND/.test(raw))return'SUSPENDED';if(/OUT/.test(raw))return'OUT';if(/DOUBTFUL/.test(raw))return'DOUBTFUL';if(/QUESTIONABLE/.test(raw))return'QUESTIONABLE';if(/LIMIT/.test(raw))return'LIMITED';if(raw==='ACTIVE')return'ACTIVE';return'UNKNOWN'};
  function normalizeReport(row={},fetchedAt=new Date().toISOString()){
    const athlete=row.athlete||row.player||{},rawStatus=clean(row.status?.name||row.status?.type||row.status||row.injuryStatus),sourcePlayerId=clean(athlete.id||row.playerId),reportedAt=row.date||row.updated||row.lastUpdated||fetchedAt;
    return Object.freeze({provider:'ESPN',sourcePlayerId,sourceTeam:clean(athlete.team?.abbreviation||row.team?.abbreviation||row.team),rawStatus,normalizedStatus:status(rawStatus),reportedAt:new Date(reportedAt).toISOString(),fetchedAt:new Date(fetchedAt).toISOString(),reliability:'analyst',injuryType:clean(row.type?.description||row.type||row.details?.type),bodyPart:clean(row.details?.location||row.bodyPart),note:clean(row.details?.detail||row.shortComment||row.comment),url:clean(row.sourceUrl)||DEFAULT_ENDPOINT});
  }
  function rowsFromPayload(payload={}){if(Array.isArray(payload))return payload;if(Array.isArray(payload.injuries))return payload.injuries;if(Array.isArray(payload.items))return payload.items;return[]}
  async function fetchReports({fetchFn=root.fetch?.bind(root),endpoint=DEFAULT_ENDPOINT,fetchedAt=new Date().toISOString()}={}){
    if(typeof fetchFn!=='function')return{reports:[],available:false,error:new Error('No fetch implementation is available.')};
    try{const response=await fetchFn(endpoint,{cache:'no-store'});if(!response?.ok)throw new Error(`ESPN request failed with HTTP ${response?.status??'unknown'}.`);const rows=rowsFromPayload(await response.json());return{reports:rows.map(row=>normalizeReport(row,fetchedAt)),available:true,unofficial:true,endpoint}}
    catch(error){return{reports:[],available:false,unofficial:true,endpoint,error}}
  }
  const api=Object.freeze({DEFAULT_ENDPOINT,status,normalizeReport,rowsFromPayload,fetchReports});root.ESPNInjuryAdapterV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
