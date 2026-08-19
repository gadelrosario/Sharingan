'use strict';

const fs=require('fs');
const path=require('path');
const {inventory}=require('../js/intelligence-core/championship-equity');

const root=path.resolve(__dirname,'..');
const players=JSON.parse(fs.readFileSync(path.join(root,'data/players.json'),'utf8'));
const injuries=JSON.parse(fs.readFileSync(path.join(root,'data/injuries_2026.json'),'utf8'));
const optional=name=>{try{return JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'))}catch{return null}};
const report=inventory.audit(players,injuries,{contextSnapshot:optional('player_context_2026.json'),projectionSnapshot:optional('projection_market_2026.json')});

process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
