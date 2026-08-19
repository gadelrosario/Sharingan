#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const Adapter=require('../js/intelligence-core/player-intake/player-context-adapter');
const root=path.resolve(__dirname,'..'),output=path.join(root,'data/player_context_2026.json');
async function main(){
  const players=JSON.parse(fs.readFileSync(path.join(root,'data/players.json'),'utf8'));
  const response=await fetch(Adapter.ENDPOINT,{headers:{accept:'application/json','user-agent':'FantasyHQ-Jonin/4.3.10'}});
  if(!response.ok)throw new Error(`Sleeper request failed with HTTP ${response.status}.`);
  const snapshot=Adapter.normalizeSnapshot(await response.json(),players,{fetchedAt:new Date().toISOString()});
  const temporary=`${output}.tmp`;fs.writeFileSync(temporary,`${JSON.stringify(snapshot,null,2)}\n`,'utf8');fs.renameSync(temporary,output);
  console.log(JSON.stringify({output,matched:snapshot.matched,unmatched:snapshot.unmatchedCount,ambiguous:snapshot.ambiguousCount,quarantined:snapshot.quarantinedCount,fetchedAt:snapshot.fetchedAt},null,2));
}
main().catch(error=>{console.error(`Sleeper player-context refresh failed; existing snapshot was preserved: ${error.message}`);process.exitCode=1});
