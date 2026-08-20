#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Validation=require('../js/intelligence-core/expanded-market-validation');

const ROOT=path.resolve(__dirname,'..'),args=process.argv.slice(2),arg=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1]};
const read=relative=>JSON.parse(fs.readFileSync(path.resolve(ROOT,relative),'utf8'));
const output=path.resolve(ROOT,arg('--output')||'outputs/historical_breakout/expanded_market_validation_4_3_17.json');

function main(){
  const universe=read('data/research/historical_identity_universe_2019_2025.json');
  const report=Validation.run({normalizedAdp:read('data/historical_adp_gsis_2019_2025.json'),usageSnapshot:read('data/historical_usage_2019_2025.json'),developmentSnapshot:read('data/historical_development_2019_2025.json'),players:universe.players});
  fs.mkdirSync(path.dirname(output),{recursive:true});const temporary=`${output}.tmp-${process.pid}`;fs.writeFileSync(temporary,`${JSON.stringify(report,null,2)}\n`);JSON.parse(fs.readFileSync(temporary,'utf8'));fs.renameSync(temporary,output);
  console.log(JSON.stringify({status:'EXPANDED_MARKET_VALIDATION_COMPLETE',output,coverage:report.coverage,readiness:report.readiness,finalDecision:report.finalDecision},null,2));return report;
}

if(require.main===module)main();
module.exports=Object.freeze({main});
