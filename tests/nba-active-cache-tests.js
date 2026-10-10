'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/nba-active-league-v1'),'utf8');
const selection={leagueKey:'478.l.1',season:'2026',name:'Test'},model={settings:{...selection,sport:'nba'},coverage:'COMPLETE'};
function runtime(response,saved){const values=new Map(saved?[['fantasyhq:nba:active:v2:2026:478.l.1',saved]]:[]),storage=new Map(saved?[['fantasyhq:nba:active:v2',JSON.stringify(selection)]]:[]);
 const indexedDB={open(){const req={};queueMicrotask(()=>{req.result={close(){},transaction(){const tx={objectStore(){return {get(key){const op={result:values.get(key)};queueMicrotask(()=>tx.oncomplete());return op;},put(value,key){values.set(key,value);const op={result:key};queueMicrotask(()=>tx.oncomplete());return op;}};}};return tx;}};req.onsuccess();});return req;}};
 const win={FantasyHQYahooNBAV1:{normalizeBundle(b){if(b.coverage!=='COMPLETE')throw Error('Partial universe');return b;}}};vm.runInNewContext(source,{window:win,indexedDB,AbortController,setTimeout,clearTimeout,fetch:async()=>{if(response instanceof Error)throw response;return {ok:response!==401,json:async()=>response};},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});return win.FantasyHQNBAActiveV1;}
(async()=>{let count=0;async function test(label,fn){await fn();count++;console.log('PASS',label);}
await test('bridge snapshot labeled cached with original model timestamp',async()=>{const a=await runtime({selection,model}).resolve();assert.equal(a.cacheStatus,'CACHED YAHOO SNAPSHOT');});
await test('network failure uses explicitly labeled offline cache',async()=>{const a=await runtime(Error('offline'),{selection,model}).resolve();assert.equal(a.cacheStatus,'OFFLINE CACHED YAHOO SNAPSHOT');});
await test('auth expiration labels cached fallback',async()=>assert.equal((await runtime(401,{selection,model}).resolve()).cacheStatus,'OFFLINE CACHED YAHOO SNAPSHOT'));
await test('no cache and failed auth rejects',async()=>assert.rejects(runtime(401).resolve()));
await test('received wrong league never falls back to older identity',async()=>assert.rejects(runtime({selection:{...selection,leagueKey:'478.l.2'},model},{selection,model}).resolve(),/mismatch/));
await test('partial received universe never falls back silently',async()=>assert.rejects(runtime({selection,bundle:{...model,coverage:'PARTIAL'}},{selection,model}).resolve(),/Partial/));
console.log(`${count}/${count} passed`);})().catch(e=>{console.error(e);process.exitCode=1;});
