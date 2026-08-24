#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const Season=require('../js/yahoo-season-v1.js'),Sync=require('../js/yahoo-sync-v1.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../tests/fixtures/yahoo/league_bundle_2026.json'),'utf8'));
const canonical=[
  {canonicalId:'fhq_alpha',name:'Alpha Runner',pos:'RB',team:'BUF',externalIds:{yahoo:'40001'}},
  {canonicalId:'fhq_beta',name:'Beta Receiver',pos:'WR',team:'DAL',externalIds:{yahoo:'40002'}},
  {canonicalId:'fhq_gamma',name:'Gamma Tight End',pos:'TE',team:'KC',externalIds:{yahoo:'40003'}},
  {canonicalId:'fhq_delta',name:'Delta Quarterback',pos:'QB',team:'PHI',externalIds:{yahoo:'40004'}}
];
const profile={id:'smoke-profile',actualTeams:10,season:2026,settings:{teams:10,scoring:'half',passTD:6}};
const memory=new Map(),storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
let connected=false,fail=false;
const transport={status:async()=>({ready:true,connected}),discover:async()=>({fetchedAt:fixture.fetchedAt,raw:fixture.league}),sync:async()=>{if(fail)throw new Error('fixture outage');return fixture;},disconnect:async()=>{connected=false;return{connected:false};}};
(async()=>{const start=Date.now(),checks=[];const check=(name,fn)=>{fn();checks.push(name);};const controller=Sync.createController({transport,storage});check('disconnected-state',()=>assert.strictEqual(connected,false));connected=true;check('fake-authorized-state',()=>assert.strictEqual(connected,true));const discovery=await controller.discover(2026);check('league-discovery',()=>assert.strictEqual(discovery.leagues.length,1));controller.mapLeague(profile,discovery.leagues[0]);check('explicit-profile-mapping',()=>assert.strictEqual(controller.read(profile.id).mapping.leagueKey,'461.l.10001'));const snapshot=(await controller.sync({profile,canonicalPlayers:canonical,archives:[]})).snapshot;check('settings-reconciliation',()=>assert.strictEqual(snapshot.settingsReconciliation.fields.teamCount.status,'MATCH'));check('all-team-rosters',()=>assert.strictEqual(snapshot.teams.length,2));check('user-team',()=>assert.strictEqual(snapshot.userTeamKey,'461.l.10001.t.1'));check('ownership-map',()=>assert.strictEqual(snapshot.ownership.ownership.fhq_alpha.teamKey,'461.l.10001.t.1'));check('optional-subsystems',()=>assert.ok(snapshot.transactions&&snapshot.standings&&snapshot.matchups));const other={...profile,id:'second-profile'};controller.mapLeague(other,discovery.leagues[0]);check('profile-isolation',()=>assert.strictEqual(controller.read(other.id).snapshot,undefined));fail=true;await assert.rejects(()=>controller.sync({profile,canonicalPlayers:canonical,archives:[]}));check('fail-soft-cache',()=>assert.strictEqual(controller.read(profile.id).snapshot.league.name,'Sanitized Test League'));const elapsedMs=Date.now()-start;assert.ok(elapsedMs<30000);console.log(JSON.stringify({status:'PASS',checks:checks.length,elapsedMs,names:checks}));})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.stack||error.message}));process.exit(1);});
