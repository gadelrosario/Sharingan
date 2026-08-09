#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const adapter=require('../js/sleeper-injury-adapter-v1.js');
const root=path.resolve(__dirname,'..');
const output=path.resolve(root,process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:'data/injuries_2026.json');
async function main(){
  const players=JSON.parse(fs.readFileSync(path.join(root,'data/players.json'),'utf8'));
  let previous=null;try{previous=JSON.parse(fs.readFileSync(output,'utf8'))}catch{}
  const response=await fetch(adapter.ENDPOINT,{headers:{accept:'application/json','user-agent':'FantasyHQ-Jonin/4.2.4'}});
  if(!response.ok)throw new Error(`Sleeper request failed with HTTP ${response.status}.`);
  const snapshot=adapter.normalizeSnapshot(await response.json(),players,{fetchedAt:new Date().toISOString(),previousSnapshot:previous});
  const temporary=`${output}.tmp`;
  fs.writeFileSync(temporary,`${JSON.stringify(snapshot,null,2)}\n`,'utf8');
  fs.renameSync(temporary,output);
  const counts=snapshot.records.reduce((result,record)=>(result[record.status]=(result[record.status]||0)+1,result),{});
  console.log(JSON.stringify({output,sourceRows:snapshot.sourceRows,eligibleSourceRows:snapshot.eligibleSourceRows,matched:snapshot.matched,unmatched:snapshot.unmatchedCount,ambiguous:snapshot.ambiguousCount,fetchedAt:snapshot.fetchedAt,statusCounts:counts},null,2));
}
main().catch(error=>{console.error(`Sleeper injury refresh failed; existing snapshot was preserved: ${error.message}`);process.exitCode=1});
