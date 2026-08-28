#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {parseCsv,writeAtomically}=require('./refresh_nflverse_historical_usage.js');
const {NflverseEvidenceAdapter,RAW_SCHEMA_VERSION}=require('../js/nflverse-evidence-adapter-v1.js');
const {SeasonPlayerRegistry}=require('../js/season-player-registry-v1.js');

const ROOT=path.resolve(__dirname,'..');
const STATS_URL=season=>`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv.gz`;
const SCHEDULE_URL='https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
const TIMESTAMP_URL='https://github.com/nflverse/nflverse-data/releases/download/stats_player/timestamp.json';
const args=process.argv.slice(2);
const arg=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1]};
const has=flag=>args.includes(flag);

function parseWeekSelection(value){
  if(!value)return null;
  const weeks=new Set();
  for(const part of value.split(',')){
    const [startText,endText]=part.split('-'),start=Number(startText),end=endText===undefined?start:Number(endText);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>22||start>end)throw new Error('weeks must use values from 1 through 22');
    for(let week=start;week<=end;week++)weeks.add(week);
  }
  return weeks;
}

async function download(url,{fetchFn=fetch,timeoutMs=30000}={}){
  const response=await fetchFn(url,{headers:{'user-agent':'FantasyHQ-Jonin-4.4.9'},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  const buffer=Buffer.from(await response.arrayBuffer());
  if(buffer.length<20)throw new Error(`${url} returned an empty or truncated response`);
  return buffer;
}

function readCsvInput(file,{gzip=false}={}){
  const buffer=fs.readFileSync(path.resolve(file));
  return parseCsv((gzip||file.endsWith('.gz')?zlib.gunzipSync(buffer):buffer).toString('utf8'));
}

function providerTimestamp(value){
  const raw=String(value||'').trim();
  if(!raw)throw new Error('nflverse provider timestamp is unavailable');
  const parsed=Date.parse(raw.replace(' EDT','-04:00').replace(' EST','-05:00'));
  if(!Number.isFinite(parsed))throw new Error('nflverse provider timestamp is invalid');
  return new Date(parsed).toISOString();
}

async function buildPayload({season,weeks,retrievedAt,statsInput,scheduleInput,timestampInput,fetchFn=fetch}){
  const statsBuffer=statsInput?null:await download(STATS_URL(season),{fetchFn});
  const scheduleBuffer=scheduleInput?null:await download(SCHEDULE_URL,{fetchFn});
  const timestampBuffer=timestampInput?null:await download(TIMESTAMP_URL,{fetchFn});
  const rows=statsInput?readCsvInput(statsInput,{gzip:statsInput.endsWith('.gz')}):parseCsv(zlib.gunzipSync(statsBuffer).toString('utf8'));
  const scheduleRows=scheduleInput?readCsvInput(scheduleInput):parseCsv(scheduleBuffer.toString('utf8'));
  const timestamp=timestampInput?JSON.parse(fs.readFileSync(path.resolve(timestampInput),'utf8')):JSON.parse(timestampBuffer.toString('utf8'));
  const selected=rows.filter(row=>Number(row.season)===season&&String(row.season_type).toUpperCase()==='REG'&&(!weeks||weeks.has(Number(row.week))));
  return {payload:{schemaVersion:RAW_SCHEMA_VERSION,provider:'nflverse',sourceUrl:STATS_URL(season),season,retrievedAt,providerUpdatedAt:providerTimestamp(timestamp.last_updated),rows:selected},scheduleRows};
}

async function main(options={}){
  const season=Number(arg('--season')||2026),weeks=parseWeekSelection(arg('--weeks')),retrievedAt=arg('--retrieved-at')||new Date().toISOString();
  if(!Number.isInteger(season)||season<2020||season>2100)throw new Error('season must be an integer from 2020 through 2100');
  const artifactOutput=path.resolve(ROOT,arg('--output')||'data/season_evidence/nflverse_latest.json');
  const reportOutput=path.resolve(ROOT,arg('--report')||'outputs/season_evidence/nflverse_quality_report.json');
  const registryOutput=path.resolve(ROOT,arg('--registry-output')||'data/season_evidence/season_player_registry.json');
  const players=JSON.parse(fs.readFileSync(path.join(ROOT,'data/players.json'),'utf8'));
  const mapping=JSON.parse(fs.readFileSync(path.join(ROOT,'data/gsis_identity_mapping_2026.json'),'utf8'));
  const registryInput=arg('--registry-input'),persistedRegistry=registryInput?JSON.parse(fs.readFileSync(path.resolve(registryInput),'utf8')):fs.existsSync(registryOutput)?JSON.parse(fs.readFileSync(registryOutput,'utf8')):null;
  const seasonRegistry=new SeasonPlayerRegistry({canonicalPlayers:players,artifact:persistedRegistry});
  const {payload,scheduleRows}=await buildPayload({season,weeks,retrievedAt,statsInput:arg('--stats-input'),scheduleInput:arg('--schedule-input'),timestampInput:arg('--timestamp-input'),fetchFn:options.fetchFn||fetch});
  if(!payload.rows.length)throw new Error(`nflverse has no regular-season player-stat rows for ${season}${weeks?` in requested weeks ${[...weeks].join(',')}`:''}; last-valid outputs were preserved`);
  const normalized=new NflverseEvidenceAdapter().normalize(payload,{players,gsisMappings:mapping.mappings,scheduleRows,seasonRegistry});
  if(!normalized.artifact.records.length)throw new Error('zero safely resolved evidence records; last-valid outputs were preserved');
  const registryArtifact=seasonRegistry.toArtifact({generatedAt:retrievedAt,sourceArtifact:normalized.artifact.sourceUrl});
  writeAtomically([{target:artifactOutput,value:normalized.artifact},{target:reportOutput,value:normalized.qualityReport},{target:registryOutput,value:registryArtifact}]);
  const result={status:'LIVE_ACCESS_SUCCESS',artifactOutput,reportOutput,registryOutput,provider:normalized.provider,season,weeks:normalized.artifact.weeks,records:normalized.artifact.records.length,playersResolved:normalized.qualityReport.playersResolved,newSeasonIdentities:normalized.qualityReport.newSeasonIdentitiesCreated,seasonRegistryIdentities:registryArtifact.players.length,rejected:normalized.qualityReport.recordsRejected,ambiguous:normalized.qualityReport.ambiguousIdentities,unresolved:normalized.qualityReport.unresolvedPlayers,recommendationAuthority:false};
  if(!options.quiet)console.log(JSON.stringify(result,null,2));
  return result;
}

if(require.main===module)main().catch(error=>{console.error(`NFL evidence refresh failed; last-valid outputs were preserved: ${error.message}`);process.exit(1)});

module.exports={STATS_URL,SCHEDULE_URL,TIMESTAMP_URL,parseWeekSelection,providerTimestamp,download,readCsvInput,buildPayload,main};
