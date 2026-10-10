/* Verified NBA primary selection. No legacy draft cache can choose a league. */
(function(root){
'use strict';
const KEY='fantasyhq:nba:active:v2';
function cache(action,key,value){return new Promise((resolve,reject)=>{const req=indexedDB.open('fantasyhq-nba-v2',1);req.onupgradeneeded=()=>req.result.createObjectStore('records');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('records',action==='get'?'readonly':'readwrite'),store=tx.objectStore('records'),op=action==='get'?store.get(key):store.put(value,key);tx.oncomplete=()=>{db.close();resolve(op.result);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
const cacheGet=key=>cache('get',key),cachePut=(key,value)=>cache('put',key,value);
function verify(data){const m=data.bundle?root.FantasyHQYahooNBAV1.normalizeBundle(data.bundle):data.model,s=data.selection;
 if(!s||m.settings.leagueKey!==s.leagueKey||m.settings.season!==String(s.season)||m.settings.name!==s.name||m.settings.sport!=='nba')throw Error('Primary NBA identity mismatch');
 return {selection:s,model:m};
}
async function resolve(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);let payload;
 try{const r=await fetch('https://localhost:8788/api/yahoo/nba/active',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Primary NBA league unavailable');payload=await r.json();const active=verify(payload);await cachePut(KEY+':'+active.selection.season+':'+active.selection.leagueKey,active);localStorage.setItem(KEY,JSON.stringify(active.selection));return active;}
 catch(error){let cached;try{cached=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}if(cached?.leagueKey){const saved=await cacheGet(KEY+':'+cached.season+':'+cached.leagueKey);if(saved)return verify(saved);}throw error;}finally{clearTimeout(timer);}
}
root.FantasyHQNBAActiveV1={resolve,cacheGet,cachePut};
})(window);
