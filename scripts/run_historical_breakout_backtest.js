'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');
const Backtest=require('../js/intelligence-core/breakout-backtest');

const root=path.resolve(__dirname,'..');
const argument=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const historicalPath=path.resolve(argument('--historical')||path.join(root,'data/historical_usage_2023_2025.json'));
const playersPath=path.resolve(argument('--players')||path.join(root,'data/players.json'));
const outputPath=path.resolve(argument('--output')||path.join(root,'outputs/historical_breakout/backtest_summary_4_3_13.json'));

function writeAtomic(target,value){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const temporary=path.join(path.dirname(target),`.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temporary,`${JSON.stringify(value,null,2)}\n`);
  JSON.parse(fs.readFileSync(temporary,'utf8'));
  fs.renameSync(temporary,target);
}

function main(){
  const historicalSnapshot=JSON.parse(fs.readFileSync(historicalPath,'utf8')),players=JSON.parse(fs.readFileSync(playersPath,'utf8'));
  const report=Backtest.runBacktest({historicalSnapshot,players});
  writeAtomic(outputPath,report);
  process.stdout.write(`${JSON.stringify({status:'SHADOW_BACKTEST_COMPLETE',outputPath,recommendationAuthority:report.recommendationAuthority,sampleSizes:report.sampleSizes,compositeCreated:report.composite.created},null,2)}\n`);
  return report;
}

if(require.main===module)main();
module.exports=Object.freeze({writeAtomic,main});
