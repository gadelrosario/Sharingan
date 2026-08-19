'use strict';

const Contract=require('./projection-market-contract');
const ACCESS_STATUS='ADAPTER_READY_CREDENTIALS_REQUIRED';
function status({apiKey,endpoint,buildRequest}={}){return Object.freeze({provider:'FantasyPros',accessStatus:apiKey&&endpoint&&typeof buildRequest==='function'?'CONFIGURED_NOT_VERIFIED':ACCESS_STATUS,liveAccessVerified:false,credentialDelivery:'SERVER_OR_LOCAL_INGESTION_ONLY'})}
function createAdapter({apiKey,endpoint,buildRequest,fetchFn=globalThis.fetch?.bind(globalThis)}={}){
  async function refresh(players,{previousSnapshot=null,season,snapshotDate=new Date().toISOString()}={}){
    if(!apiKey||!endpoint||typeof buildRequest!=='function'||typeof fetchFn!=='function')return{snapshot:previousSnapshot,source:previousSnapshot?'stale-cache':'none',refreshed:false,status:ACCESS_STATUS};
    try{
      const request=buildRequest({endpoint,apiKey,season});
      const response=await fetchFn(request.url,request.options);
      if(!response?.ok)throw new Error(`FantasyPros request failed with HTTP ${response?.status??'unknown'}.`);
      const body=await response.json(),rows=Array.isArray(body)?body:body?.players;
      if(!Array.isArray(rows)||!rows.length)throw new Error('FantasyPros returned no projection rows.');
      return{snapshot:Contract.normalizeProviderSnapshot(rows,players,{provider:'FantasyPros',externalIdKey:'fantasyPros',season,snapshotDate}),source:'network',refreshed:true,status:'LIVE_API_AVAILABLE'};
    }catch(error){return{snapshot:previousSnapshot?{...previousSnapshot,cacheState:'STALE',refreshError:error.message}:null,source:previousSnapshot?'stale-cache':'none',refreshed:false,status:'REFRESH_FAILED',error}}
  }
  return Object.freeze({getStatus:()=>status({apiKey,endpoint,buildRequest}),refresh});
}
module.exports=Object.freeze({ACCESS_STATUS,status,createAdapter});
