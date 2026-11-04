'use strict';
const assert=require('node:assert/strict');
const Sync=require('../js/nfl-proactive-sync-v1');
(async()=>{
 let count=0;const test=async(n,f)=>{await f();count++;console.log('PASS '+n);};
 await test('loads exact encoded league scope without provider calls',async()=>{let url;const c=Sync.create({scope:'a:b',fetchFn:async u=>{url=u;return {ok:true,json:async()=>({state:{key:'a:b'}})};}});await c.load();assert.equal(url,'https://localhost:8787/api/nfl-monitoring/state?scope=a%3Ab');});
 await test('wrong durable league fails closed',async()=>{const c=Sync.create({scope:'a',fetchFn:async()=>({ok:true,json:async()=>({state:{key:'b'}})})});await assert.rejects(c.load(),/scope/);});
 await test('unavailable bridge preserves explicit failure',async()=>{const c=Sync.create({scope:'a',fetchFn:async()=>({ok:false})});await assert.rejects(c.load(),/unavailable/);});
 await test('interaction replay retains original timestamp and sends no auth token',async()=>{let init;const c=Sync.create({scope:'a',fetchFn:async(u,i)=>{init=i;return {ok:true,json:async()=>({})};}});await c.interact('alert','SNOOZED',1000);assert.deepEqual(JSON.parse(init.body),{scope:'a',id:'alert',action:'SNOOZED',at:1000});assert.deepEqual(init.headers,{'Content-Type':'application/json'});});
 await test('checkpoint includes optimistic revision',async()=>{let body;const c=Sync.create({scope:'a',fetchFn:async(u,i)=>{body=JSON.parse(i.body);return {ok:true,json:async()=>({})};}});await c.checkpoint({key:'a'},7);assert.equal(body.revision,7);assert.equal(body.scope,'a');});
 await test('quiet preferences remain league scoped',async()=>{let body;const c=Sync.create({scope:'a',fetchFn:async(u,i)=>{body=JSON.parse(i.body);return {ok:true,json:async()=>({})};}});await c.preferences({enabled:true,quietStartUTC:22,quietEndUTC:7});assert.equal(body.scope,'a');assert.equal(body.preferences.quietStartUTC,22);});
 console.log(`${count}/${count} passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
