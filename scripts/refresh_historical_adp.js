#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');

const YEARS=Object.freeze([2019,2020,2021,2022,2023,2024,2025]);
const URL_TEMPLATE='https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year={YEAR}&position=all';
const urlFor=year=>URL_TEMPLATE.replace('{YEAR}',String(year));

function normalizeResponse(payload,year){
  if(payload?.status!=='Success'||payload?.meta?.type!=='Half-PPR'||Number(payload?.meta?.teams)!==12||!Array.isArray(payload?.players))throw new TypeError(`unexpected Fantasy Football Calculator response for ${year}`);
  return Object.freeze({requestedYear:year,status:payload.status,meta:payload.meta,players:payload.players});
}

async function buildSnapshot({fetchFn=globalThis.fetch,retrievedAt=new Date().toISOString(),years=YEARS}={}){
  if(typeof fetchFn!=='function')throw new TypeError('fetch implementation is required');
  const seasons=[];
  for(const year of years){
    const response=await fetchFn(urlFor(year),{headers:{Accept:'application/json'}});
    if(!response?.ok)throw new Error(`Fantasy Football Calculator ${year} request failed: HTTP ${response?.status??'UNKNOWN'}`);
    seasons.push(normalizeResponse(await response.json(),year));
  }
  return Object.freeze({schemaVersion:1,provider:'Fantasy Football Calculator',providerKey:'FANTASY_FOOTBALL_CALCULATOR',sourceUrlTemplate:URL_TEMPLATE,retrievedAt,scoringFormat:'HALF_PPR',leagueSize:12,draftType:'REDRAFT',recommendationAuthority:false,seasons:Object.freeze(seasons)});
}

async function main(){
  const output=path.resolve(process.argv[2]||path.join(__dirname,'../data/research/historical_adp/fantasy_football_calculator_half_ppr_12_2019_2025.json'));
  const snapshot=await buildSnapshot();
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const temporary=path.join(path.dirname(output),`.${path.basename(output)}.${process.pid}.tmp`);
  fs.writeFileSync(temporary,`${JSON.stringify(snapshot,null,2)}\n`);
  fs.renameSync(temporary,output);
  process.stdout.write(`${JSON.stringify({status:'HISTORICAL_ADP_REFRESH_COMPLETE',output,seasons:snapshot.seasons.map(row=>({year:row.requestedYear,rows:row.players.length,drafts:row.meta.total_drafts}))},null,2)}\n`);
}

if(require.main===module)main().catch(error=>{console.error(error.message);process.exit(1)});
module.exports=Object.freeze({YEARS,URL_TEMPLATE,urlFor,normalizeResponse,buildSnapshot});
