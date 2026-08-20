'use strict';

const fs=require('fs');
const path=require('path');
const DevelopmentBacktest=require('../js/intelligence-core/breakout-backtest/development-analysis');

const root=path.resolve(__dirname,'..');
const argument=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null};
const usagePath=path.resolve(argument('--historical')||path.join(root,'data/historical_usage_2023_2025.json'));
const developmentPath=path.resolve(argument('--development')||path.join(root,'data/historical_development_2023_2025.json'));
const playersPath=path.resolve(argument('--players')||path.join(root,'data/players.json'));
const baselinePath=path.resolve(argument('--baseline')||path.join(root,'outputs/historical_breakout/backtest_summary_4_3_13.json'));
const outputPath=path.resolve(argument('--output')||path.join(root,'outputs/historical_breakout/development_backtest_summary_4_3_15.json'));

function writeAtomic(target,value){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const temporary=path.join(path.dirname(target),`.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temporary,`${JSON.stringify(value,null,2)}\n`);
  JSON.parse(fs.readFileSync(temporary,'utf8'));
  fs.renameSync(temporary,target);
}

function main(){
  const historicalSnapshot=JSON.parse(fs.readFileSync(usagePath,'utf8'));
  const developmentSnapshot=JSON.parse(fs.readFileSync(developmentPath,'utf8'));
  const players=JSON.parse(fs.readFileSync(playersPath,'utf8'));
  const usageBaseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
  const report=DevelopmentBacktest.runDevelopmentBacktest({historicalSnapshot,developmentSnapshot,players,usageBaseline});
  writeAtomic(outputPath,report);
  process.stdout.write(`${JSON.stringify({status:'DEVELOPMENT_BACKTEST_COMPLETE',outputPath,recommendationAuthority:report.recommendationAuthority,finalDecision:report.finalDecision},null,2)}\n`);
  return report;
}

if(require.main===module)main();
module.exports=Object.freeze({writeAtomic,main});
