#!/usr/bin/env node
'use strict';

const fs=require('node:fs'),path=require('node:path');
const usage=require('../js/intelligence-core/historical-usage');
const ROOT=path.resolve(__dirname,'..');
const PLAYERS_URL='https://github.com/nflverse/nflverse-data/releases/download/players/players.csv';
const STATS_URL=season=>`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;
const args=process.argv.slice(2),arg=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1]};
const mappingOutput=path.resolve(ROOT,arg('--mapping-output')||'data/gsis_identity_mapping_2026.json');
const usageOutput=path.resolve(ROOT,arg('--usage-output')||'data/historical_usage_2023_2025.json');
const snapshotDate=arg('--snapshot-date')||new Date().toISOString();
function parseCsv(text){
  if(typeof text!=='string'||!text.trim())throw new Error('empty or truncated source');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const char=text[i],next=text[i+1];if(char==='"'&&quoted&&next==='"'){field+='"';i++;continue}if(char==='"'){quoted=!quoted;continue}if(char===','&&!quoted){row.push(field);field='';continue}if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')i++;row.push(field);field='';if(row.some(value=>value!==''))rows.push(row);row=[];continue}field+=char}
  if(quoted)throw new Error('truncated CSV quotation');if(field||row.length){row.push(field);rows.push(row)}if(rows.length<2)throw new Error('source contains no data rows');
  const headers=rows.shift().map(value=>value.trim());if(new Set(headers).size!==headers.length)throw new Error('duplicate CSV headers');
  return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
}
function parseSource(buffer,label){const text=buffer.toString('utf8');try{const parsed=JSON.parse(text);if(!Array.isArray(parsed))throw new Error(`${label} JSON must be an array`);if(!parsed.length)throw new Error(`${label} is empty`);return parsed}catch(error){if(text.trim().startsWith('[')||text.trim().startsWith('{'))throw error;return parseCsv(text)}}
async function download(url,fetchFn=fetch){const response=await fetchFn(url,{headers:{'user-agent':'FantasyHQ-Jonin-4.3.12'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<100)throw new Error(`${url} returned a truncated payload`);return bytes}
async function load(input,url,label){return input?fs.readFileSync(path.resolve(input)):download(url).catch(error=>{throw new Error(`${label} download failed: ${error.message}`)})}
function writeAtomically(outputs){const staged=[];try{outputs.forEach(({target,value})=>{fs.mkdirSync(path.dirname(target),{recursive:true});const temporary=`${target}.tmp-${process.pid}`;fs.writeFileSync(temporary,`${JSON.stringify(value,null,2)}\n`,'utf8');JSON.parse(fs.readFileSync(temporary,'utf8'));staged.push({target,temporary})});staged.forEach(item=>fs.renameSync(item.temporary,item.target))}catch(error){staged.forEach(item=>{try{if(fs.existsSync(item.temporary))fs.unlinkSync(item.temporary)}catch{}});throw error}}
async function main(){
  const canonical=JSON.parse(fs.readFileSync(path.join(ROOT,'data/players.json'),'utf8'));
  const playerRows=parseSource(await load(arg('--players-input'),PLAYERS_URL,'player mapping'),'player mapping');
  const mapping=usage.gsisMapping.reconcilePlayerRows(playerRows,canonical,{snapshotDate});
  if(!mapping.mappings.length)throw new Error('zero safe GSIS mappings; last-valid outputs were preserved');
  const mappedCanonical=usage.gsisMapping.applyMappings(canonical,mapping),statsRows=[];
  const supplied=arg('--stats-input');
  if(supplied){for(const file of supplied.split(',').filter(Boolean))statsRows.push(...parseSource(fs.readFileSync(path.resolve(file)),`stats ${file}`))}
  else for(const season of usage.nflverse.DEFAULT_SEASONS)statsRows.push(...parseSource(await download(STATS_URL(season)),`stats ${season}`));
  const normalized=usage.nflverse.normalizeSnapshot(statsRows,mappedCanonical,{snapshotDate});
  if(!normalized.records.length)throw new Error('zero safe historical records; last-valid outputs were preserved');
  const historical=usage.aggregateSnapshot(normalized);
  writeAtomically([{target:mappingOutput,value:mapping},{target:usageOutput,value:historical}]);
  console.log(JSON.stringify({status:'LIVE_ACCESS_SUCCESS',mappingOutput,usageOutput,mappedPlayers:mapping.mapped,historicalPlayers:historical.players.length,historicalRecords:normalized.records.length,unmatchedMappings:mapping.unmatchedCount,ambiguousMappings:mapping.ambiguousCount,quarantinedMappings:mapping.quarantinedCount},null,2));
}
if(require.main===module)main().catch(error=>{console.error(`NFLVERSE refresh failed; last-valid outputs were preserved: ${error.message}`);process.exit(1)});

module.exports={parseCsv,parseSource,writeAtomically,download,main,PLAYERS_URL,STATS_URL};
