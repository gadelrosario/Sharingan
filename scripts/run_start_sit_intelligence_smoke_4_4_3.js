'use strict';
const Season=require('../js/season-command-center-v1.js'),StartSit=require('../js/start-sit-intelligence-v1.js'),fixture=require('../tests/fixtures/yahoo/season_command_center_demo.json');
const started=Date.now(),profile={id:'primary-league',settings:{startQB:1,startRB:2,startWR:2,startTE:1,flex:1,startK:1,startDST:1,bench:6,rosterSlots:['QB','RB','RB','WR','WR','TE','FLEX','K','DST','BN','BN','BN','BN','BN','BN']}},model=Season.buildModel({state:JSON.parse(JSON.stringify(fixture)),profile,demo:true}),result=StartSit.evaluate({model,profile});
if(result.status!=='EVALUATED')throw new Error(`Unexpected status: ${result.status}`);
if(!result.primary)throw new Error('Sanitized fixture did not produce a bounded primary lineup decision.');
if(result.signals.chidori)throw new Error('Sanitized demo unexpectedly activated Chidori.');
if(new Set(result.lineup.assignedAlternativeIds).size!==result.lineup.assignedAlternativeIds.length)throw new Error('Lineup assignment reused an alternative.');
console.log(JSON.stringify({status:'PASS',elapsedMs:Date.now()-started,decisionCount:result.decisions.length,primaryState:result.primary.state,primarySlot:result.primary.lineupSlot,preferred:result.primary.preferred.name,sharingan:result.signals.sharinganStart?'START':result.signals.sharinganWatch?'WATCH':'HOLD',chidori:false}));
