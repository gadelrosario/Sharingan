'use strict';

const fs=require('fs');
const path=require('path');
const {inventory}=require('../js/intelligence-core/championship-equity');

const root=path.resolve(__dirname,'..');
const players=JSON.parse(fs.readFileSync(path.join(root,'data/players.json'),'utf8'));
const injuries=JSON.parse(fs.readFileSync(path.join(root,'data/injuries_2026.json'),'utf8'));
const report=inventory.audit(players,injuries);

process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
