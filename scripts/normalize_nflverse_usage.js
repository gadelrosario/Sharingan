#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),usage=require('../js/intelligence-core/historical-usage');
const args=process.argv.slice(2),value=flag=>{const index=args.indexOf(flag);return index>=0?args[index+1]:null},input=value('--input'),output=value('--output')||'data/historical_usage_2023_2025.json',snapshotDate=value('--snapshot-date');
if(!input||!snapshotDate){console.error('Usage: node scripts/normalize_nflverse_usage.js --input nflverse-player-stats.json --snapshot-date ISO_DATE [--output PATH]');process.exit(2)}
try{
  const root=path.resolve(__dirname,'..'),rows=JSON.parse(fs.readFileSync(path.resolve(input),'utf8')),players=JSON.parse(fs.readFileSync(path.join(root,'data/players.json'),'utf8')),snapshot=usage.nflverse.normalizeSnapshot(rows,players,{snapshotDate,fallbackResolver:usage.nflverse.buildVerifiedFallback(players)});
  if(!snapshot.records.length)throw new Error('zero safe canonical matches; existing output was preserved');
  const normalized=usage.aggregateSnapshot(snapshot),target=path.resolve(root,output),temporary=`${target}.tmp`;
  fs.writeFileSync(temporary,`${JSON.stringify(normalized,null,2)}\n`,'utf8');fs.renameSync(temporary,target);console.log(JSON.stringify({output:target,records:snapshot.matchedRecords,players:normalized.players.length,unmatched:snapshot.unmatchedCount,ambiguous:snapshot.ambiguousCount,quarantined:snapshot.quarantinedCount},null,2));
}catch(error){console.error(`nflverse normalization failed; existing output was preserved: ${error.message}`);process.exit(1)}
