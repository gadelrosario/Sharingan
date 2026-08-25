'use strict';
const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),started=Date.now(),runs=['tests/waiver-intelligence-4-4-2-tests.js','tests/season-multi-profile-4-4-1-tests.js'],results=[];
for(const script of runs){const run=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',timeout:25000});if(run.status!==0)throw new Error(`${script} failed: ${run.stdout}${run.stderr}`);results.push({script,...JSON.parse(run.stdout.trim().split('\n').pop())})}
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const contract of ['seasonWaiverEvaluation','seasonWaiverRow','renderSeasonWaivers','SHARINGAN WAIVER PICK','CHIDORI ALERT','FAAB: Not yet scored'])if(!app.includes(contract))throw new Error(`UI contract missing: ${contract}`);
if(!html.includes('js/waiver-intelligence-v1.js?v=1.0.0'))throw new Error('Waiver module is not loaded before the app.');
const elapsedMs=Date.now()-started;if(elapsedMs>=30000)throw new Error(`Smoke exceeded 30 seconds: ${elapsedMs}ms`);
console.log(JSON.stringify({status:'PASS',elapsedMs,verified:['candidate evaluation','add/drop pairing','ACT / WAIT / HOLD','Sharingan signals','fail-closed behavior','multi-profile isolation'],results}));
