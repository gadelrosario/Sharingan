#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Shadow=require('../js/intelligence-core/championship-equity-shadow-v1');
const Harness=require('../tests/recommendation-baseline-harness');

const ROOT=path.resolve(__dirname,'..'),args=process.argv.slice(2),arg=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1]};
const read=relative=>JSON.parse(fs.readFileSync(path.resolve(ROOT,relative),'utf8'));
const output=path.resolve(ROOT,arg('--output')||'outputs/championship_equity/shadow_composite_4_3_18.json');

function productionContext(){
  const harness=Harness.createHarness(),opening=harness.snapshot('championship-equity-opening'),rankById=new Map(opening.topFive.map((row,index)=>[String(row.id),index+1]));
  const pool=harness.fullPool(),maximumMamba=Math.max(...pool.filter(row=>row.eligible).map(row=>row.mambaScore));
  return pool.map(row=>Object.freeze({...row,openingRecommendationRank:rankById.get(String(row.id))||null,mambaGapToLeader:maximumMamba-row.mambaScore}));
}

function build(){
  const universe=read('data/research/historical_identity_universe_2019_2025.json');
  return Shadow.run({players:read('data/players.json'),usageSnapshot:read('data/historical_usage_2019_2025.json'),developmentSnapshot:read('data/historical_development_2019_2025.json'),normalizedAdp:read('data/historical_adp_gsis_2019_2025.json'),researchPlayers:universe.players,validationBaseline:read('outputs/historical_breakout/expanded_market_validation_4_3_17.json'),productionContext:productionContext()});
}

function main(){
  const report=build();fs.mkdirSync(path.dirname(output),{recursive:true});const temporary=`${output}.tmp-${process.pid}`;fs.writeFileSync(temporary,`${JSON.stringify(report,null,2)}\n`);JSON.parse(fs.readFileSync(temporary,'utf8'));fs.renameSync(temporary,output);
  console.log(JSON.stringify({status:'CHAMPIONSHIP_EQUITY_SHADOW_COMPLETE',output,recommendationAuthority:report.recommendationAuthority,currentCoverage:{total:report.current2026.totalPlayers,scored:report.current2026.scoredPlayers,distributions:report.scoreDistribution},retro:report.historicalRetro.positions,finalDecision:report.finalDecision},null,2));return report;
}

if(require.main===module)main();
module.exports=Object.freeze({productionContext,build,main});
