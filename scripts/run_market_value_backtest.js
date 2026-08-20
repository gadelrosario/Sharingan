#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const HistoricalAdp=require('../js/intelligence-core/historical-adp');
const MarketBacktest=require('../js/intelligence-core/market-value-backtest');

const ROOT=path.resolve(__dirname,'..');
const read=relative=>JSON.parse(fs.readFileSync(path.join(ROOT,relative),'utf8'));
const stable=(value,space=2)=>`${JSON.stringify(value,null,space)}\n`;
const write=(relative,value)=>{const destination=path.join(ROOT,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,stable(value));return destination;};

function run(){
  const raw=read('data/research/historical_adp/fantasy_football_calculator_half_ppr_12_2019_2025.json');
  const players=read('data/players.json');
  const normalized=HistoricalAdp.normalizeSnapshot(raw,players);
  const report=MarketBacktest.runMarketBacktest({
    normalizedAdp:normalized,
    usageSnapshot:read('data/historical_usage_2023_2025.json'),
    developmentSnapshot:read('data/historical_development_2023_2025.json'),
    players,
    productionBaseline:read('outputs/historical_breakout/backtest_summary_4_3_13.json'),
  });
  const normalizedPath=write('data/historical_adp_2019_2025.json',normalized);
  const reportPath=write('outputs/historical_breakout/market_value_appreciation_summary_4_3_16.json',report);
  return{normalizedPath,reportPath,coverage:normalized.coverage,transitions:HistoricalAdp.buildTransitions(normalized).length,finalDecision:report.finalDecision};
}

if(require.main===module)console.log(JSON.stringify(run(),null,2));
module.exports=Object.freeze({run,stable});
