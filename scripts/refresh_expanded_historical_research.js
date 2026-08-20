#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Usage=require('../js/intelligence-core/historical-usage');
const Development=require('../js/intelligence-core/historical-development');
const HistoricalAdp=require('../js/intelligence-core/historical-adp');
const Existing=require('./refresh_nflverse_historical_usage');

const ROOT=path.resolve(__dirname,'..');
const SEASONS=Object.freeze([2019,2020,2021,2022,2023,2024,2025]);
const args=process.argv.slice(2),arg=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1]};
const target=(flag,fallback)=>path.resolve(ROOT,arg(flag)||fallback);

async function loadRows(){
  const playerInput=arg('--players-input'),statsInput=arg('--stats-input');
  const playerBytes=playerInput?fs.readFileSync(path.resolve(playerInput)):await Existing.download(Existing.PLAYERS_URL);
  const playerRows=Existing.parseSource(playerBytes,'nflverse players'),statsRows=[];
  if(statsInput){for(const file of statsInput.split(',').filter(Boolean))statsRows.push(...Existing.parseSource(fs.readFileSync(path.resolve(file)),`nflverse stats ${file}`));}
  else for(const season of SEASONS)statsRows.push(...Existing.parseSource(await Existing.download(Existing.STATS_URL(season)),`nflverse stats ${season}`));
  return{playerRows,statsRows};
}

async function main(){
  const snapshotDate=arg('--snapshot-date')||new Date().toISOString(),canonical=JSON.parse(fs.readFileSync(path.join(ROOT,'data/players.json'),'utf8')),{playerRows,statsRows}=await loadRows();
  const canonicalMapping=Usage.gsisMapping.reconcilePlayerRows(playerRows,canonical,{snapshotDate});
  const universe=Usage.gsisMapping.buildResearchUniverse(playerRows,canonical,canonicalMapping,statsRows);
  if(!universe.players.length||universe.duplicateCanonicalIds)throw new Error('unsafe or empty historical identity universe');
  const normalized=Usage.nflverse.normalizeSnapshot(statsRows,universe.players,{seasons:SEASONS,snapshotDate});
  if(!normalized.records.length)throw new Error('zero historical usage records');
  const fieldAvailability=Object.fromEntries(SEASONS.map(season=>{const rows=normalized.records.filter(row=>row.season===season);return[season,Object.fromEntries(Usage.SUM_FIELDS.map(field=>[field,Object.freeze({records:rows.filter(row=>row.stats[field]!==null).length,totalRecords:rows.length,rate:rows.length?rows.filter(row=>row.stats[field]!==null).length/rows.length:null})]))]}));
  const aggregated=Usage.aggregateSnapshot(normalized),usage=Object.freeze({...aggregated,sourceRows:statsRows.length,fieldAvailability:Object.freeze(fieldAvailability)});
  const mappingSnapshot={schemaVersion:1,source:'nflverse',sourceSnapshotDate:new Date(snapshotDate).toISOString(),mappings:universe.mappings};
  const development=Development.normalizeSnapshot(playerRows,mappingSnapshot,usage,{snapshotDate});
  const adpRaw=JSON.parse(fs.readFileSync(path.join(ROOT,'data/research/historical_adp/fantasy_football_calculator_half_ppr_12_2019_2025.json'),'utf8'));
  const adp=HistoricalAdp.normalizeSnapshot(adpRaw,universe.players);
  const outputs=[
    {target:target('--universe-output','data/research/historical_identity_universe_2019_2025.json'),value:universe},
    {target:target('--usage-output','data/historical_usage_2019_2025.json'),value:usage},
    {target:target('--development-output','data/historical_development_2019_2025.json'),value:development},
    {target:target('--adp-output','data/historical_adp_gsis_2019_2025.json'),value:adp},
  ];
  Existing.writeAtomically(outputs);
  console.log(JSON.stringify({status:'EXPANDED_HISTORICAL_RESEARCH_COMPLETE',seasons:SEASONS,sourceRows:statsRows.length,universe:{players:universe.players.length,current:universe.currentCanonicalPlayers,historicalOnly:universe.historicalOnlyPlayers,ambiguous:universe.ambiguous.length,quarantined:universe.quarantined.length},usage:{weeklyRecords:normalized.records.length,seasonRecords:usage.players.length,matchedPlayers:normalized.matchedPlayers,unmatched:normalized.unmatchedCount,ambiguous:normalized.ambiguousCount,quarantined:normalized.quarantinedCount,quarantineReasons:normalized.quarantineReasonCounts},development:development.coverage,adp:adp.coverage,fieldAvailability,outputs:outputs.map(item=>item.target)},null,2));
}

if(require.main===module)main().catch(error=>{console.error(`Expanded historical refresh failed; outputs preserved: ${error.message}`);process.exit(1)});
module.exports=Object.freeze({SEASONS,loadRows,main});
