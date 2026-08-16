(function(root){
  'use strict';
  const PROVIDER='Sleeper',CDN_ROOT='https://sleepercdn.com/content/nfl/players';
  const text=value=>String(value??'').trim();
  const canonicalKey=value=>text(value?.id??value?.playerId??value);
  const fallback=(playerId=null)=>Object.freeze({canonicalPlayerId:canonicalKey(playerId)||null,available:false,url:null,provider:null,providerPlayerId:null,source:null});
  function createRegistry(snapshot={}){
    const byCanonicalId=new Map();
    for(const record of Array.isArray(snapshot?.records)?snapshot.records:[]){
      const canonicalPlayerId=canonicalKey(record?.playerId),providerPlayerId=text(record?.sourcePlayerId);
      if(!canonicalPlayerId||!providerPlayerId||byCanonicalId.has(canonicalPlayerId))continue;
      byCanonicalId.set(canonicalPlayerId,Object.freeze({canonicalPlayerId,available:true,url:`${CDN_ROOT}/${encodeURIComponent(providerPlayerId)}.jpg`,provider:PROVIDER,providerPlayerId,source:'bundled canonical Sleeper identity reconciliation'}));
    }
    return Object.freeze({size:byCanonicalId.size,resolve(playerOrId){return byCanonicalId.get(canonicalKey(playerOrId))||fallback(playerOrId)},has(playerOrId){return byCanonicalId.has(canonicalKey(playerOrId))}});
  }
  const emptyRegistry=createRegistry();
  const api=Object.freeze({PROVIDER,CDN_ROOT,canonicalKey,createRegistry,fallback,emptyRegistry});
  root.PlayerPhotoV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
