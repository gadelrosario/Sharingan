#!/usr/bin/env node
'use strict';

const fs=require('node:fs'),path=require('node:path');
const Development=require('../js/intelligence-core/historical-development');
const ExistingRefresh=require('./refresh_nflverse_historical_usage');
const ROOT=path.resolve(__dirname,'..');
const PLAYERS_URL=ExistingRefresh.PLAYERS_URL;
const args=process.argv.slice(2),arg=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1]};
const output=path.resolve(ROOT,arg('--output')||'data/historical_development_2023_2025.json');

async function main(){
  const input=arg('--players-input');
  const bytes=input?fs.readFileSync(path.resolve(input)):await ExistingRefresh.download(PLAYERS_URL);
  const rows=ExistingRefresh.parseSource(bytes,'nflverse players');
  const mapping=JSON.parse(fs.readFileSync(path.join(ROOT,'data/gsis_identity_mapping_2026.json'),'utf8'));
  const historical=JSON.parse(fs.readFileSync(path.join(ROOT,'data/historical_usage_2023_2025.json'),'utf8'));
  const snapshot=Development.normalizeSnapshot(rows,mapping,historical,{snapshotDate:arg('--snapshot-date')||new Date().toISOString()});
  if(!snapshot.players.length)throw new Error('zero safe player development records; last-valid output was preserved');
  ExistingRefresh.writeAtomically([{target:output,value:snapshot}]);
  console.log(JSON.stringify({status:'LIVE_ACCESS_SUCCESS',output,matchedPlayers:snapshot.matchedPlayers,staticMetadataPlayers:snapshot.players.length,historicalSeasonRecords:snapshot.records.length,coverage:snapshot.coverage,unmatched:snapshot.unmatchedCount,quarantined:snapshot.quarantinedCount,sampleSlices:Development.sampleSlices(snapshot)},null,2));
}

if(require.main===module)main().catch(error=>{console.error(`Historical development refresh failed; last-valid output was preserved: ${error.message}`);process.exit(1)});
module.exports={main,PLAYERS_URL};
