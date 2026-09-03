#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {parseCsv,writeAtomically}=require('./refresh_nflverse_historical_usage.js');
const {NflverseParticipationAdapter,RAW_SCHEMA_VERSION,SUPPORTED_POSITIONS}=require('../js/nflverse-participation-adapter-v1.js');
const {SeasonPlayerRegistry}=require('../js/season-player-registry-v1.js');

const ROOT=path.resolve(__dirname,'..');
const SNAP_URL=season=>`https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${season}.csv`;
const PLAYERS_URL='https://github.com/nflverse/nflverse-data/releases/download/players/players.csv';
const args=process.argv.slice(2);
const arg=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1]};

function parseWeekSelection(value){if(!value)return null;const weeks=new Set();for(const part of value.split(',')){const [first,last=first]=part.split('-'),start=Number(first),end=Number(last);if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>22||start>end)throw new Error('weeks must use values from 1 through 22');for(let week=start;week<=end;week++)weeks.add(week)}return weeks}
async function download(url,{fetchFn=fetch,timeoutMs=30000}={}){const response=await fetchFn(url,{headers:{'user-agent':'FantasyHQ-Jonin-4.4.10.1'},signal:AbortSignal.timeout(timeoutMs)});if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);const text=await response.text();if(text.length<20)throw new Error(`${url} returned an empty or truncated response`);const updated=response.headers?.get?.('last-modified');return{text,providerUpdatedAt:updated&&Number.isFinite(Date.parse(updated))?new Date(updated).toISOString():null}}
function inputRows(file){return parseCsv(fs.readFileSync(path.resolve(file),'utf8'))}
function latestThreeWeeks(rows){const values=[...new Set(rows.map(row=>Number(row.week)).filter(Number.isInteger))].sort((a,b)=>a-b);return new Set(values.slice(-3))}

async function buildPayload({season,currentSeason,weeks,retrievedAt,snapInput,playersInput,providerUpdatedAt,fetchFn=fetch}){
  const snap=snapInput?{text:null,providerUpdatedAt:null}:await download(SNAP_URL(season),{fetchFn}),directory=playersInput?{text:null}:await download(PLAYERS_URL,{fetchFn});
  const allRows=snapInput?inputRows(snapInput):parseCsv(snap.text),playerDirectoryRows=playersInput?inputRows(playersInput):parseCsv(directory.text);
  const eligible=allRows.filter(row=>Number(row.season)===season&&String(row.game_type).trim().toUpperCase()==='REG'&&SUPPORTED_POSITIONS.has(String(row.position).trim().toUpperCase()));
  const selectedWeeks=weeks||latestThreeWeeks(eligible),rows=eligible.filter(row=>selectedWeeks.has(Number(row.week)));
  const updated=providerUpdatedAt||snap.providerUpdatedAt;
  if(!updated)throw new Error('provider update timestamp is required when the source does not expose Last-Modified');
  return{schemaVersion:RAW_SCHEMA_VERSION,provider:'nflverse',sourceUrl:SNAP_URL(season),playerDirectoryUrl:PLAYERS_URL,season,currentSeason,retrievedAt,providerUpdatedAt:updated,rows,playerDirectoryRows};
}

async function main(options={}){
  const season=Number(arg('--season')||2026),currentSeason=Number(arg('--current-season')||2026),weeks=parseWeekSelection(arg('--weeks')),retrievedAt=arg('--retrieved-at')||new Date().toISOString();
  if(!Number.isInteger(season)||season<2020||season>2100||!Number.isInteger(currentSeason)||currentSeason<season)throw new Error('season/current-season selection is invalid');
  const artifactOutput=path.resolve(ROOT,arg('--output')||'data/season_evidence/nflverse_participation_latest.json'),reportOutput=path.resolve(ROOT,arg('--report')||'outputs/season_evidence/nflverse_participation_quality_report.json'),registryOutput=path.resolve(ROOT,arg('--registry-output')||'data/season_evidence/season_player_registry.json');
  const players=JSON.parse(fs.readFileSync(path.join(ROOT,'data/players.json'),'utf8')),mapping=JSON.parse(fs.readFileSync(path.join(ROOT,'data/gsis_identity_mapping_2026.json'),'utf8')),registryInput=arg('--registry-input'),persistedRegistry=registryInput?JSON.parse(fs.readFileSync(path.resolve(registryInput),'utf8')):fs.existsSync(registryOutput)?JSON.parse(fs.readFileSync(registryOutput),'utf8'):null,seasonRegistry=new SeasonPlayerRegistry({canonicalPlayers:players,artifact:persistedRegistry});
  const payload=await buildPayload({season,currentSeason,weeks,retrievedAt,snapInput:arg('--snap-input'),playersInput:arg('--players-input'),providerUpdatedAt:arg('--provider-updated-at'),fetchFn:options.fetchFn||fetch});
  if(!payload.rows.length)throw new Error(`nflverse has no regular-season snap-count rows for ${season}; last-valid outputs were preserved`);
  const normalized=new NflverseParticipationAdapter().normalize(payload,{players,gsisMappings:mapping.mappings,seasonRegistry});
  if(!normalized.artifact.records.length)throw new Error('zero safely resolved participation records; last-valid outputs were preserved');
  const registryArtifact=seasonRegistry.toArtifact({generatedAt:retrievedAt,sourceArtifact:normalized.artifact.sourceUrl});
  writeAtomically([{target:artifactOutput,value:normalized.artifact},{target:reportOutput,value:normalized.qualityReport},{target:registryOutput,value:registryArtifact}]);
  const result={status:normalized.artifact.evidenceStatus,artifactOutput,reportOutput,registryOutput,season,weeks:normalized.artifact.weeks,records:normalized.artifact.recordCount,playersResolved:normalized.qualityReport.playersResolved,newSeasonIdentities:normalized.qualityReport.newSeasonIdentitiesCreated,rejected:normalized.qualityReport.recordsRejected,currentActionableEvidence:normalized.artifact.currentActionableEvidence,recommendationAuthority:false,transactionAuthority:false};
  if(!options.quiet)console.log(JSON.stringify(result,null,2));return result;
}

if(require.main===module)main().catch(error=>{console.error(`NFL participation refresh failed; last-valid outputs were preserved: ${error.message}`);process.exit(1)});
module.exports={SNAP_URL,PLAYERS_URL,parseWeekSelection,download,inputRows,latestThreeWeeks,buildPayload,main};
