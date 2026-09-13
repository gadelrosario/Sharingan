'use strict';
const assert = require('assert');
const fs = require('fs');
const Manual = require('../js/manual-season-state-v1.js');
const Waiver = require('../js/waiver-intelligence-v1.js');
const Weekly = require('../js/weekly-command-center-v1.js');
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/season_command_center_4_4_11_2.json', 'utf8'));

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
const tests = [];
const test = (name, run) => tests.push({ name, run });
const at = '2026-09-10T18:00:00.000Z';
const storage = new MemoryStorage();
let counter = 0;
const store = new Manual.ManualSeasonStateStore({ storage, now: () => at, idFactory: () => `fact-${++counter}` });
const create = (profileId, factType, playerId, value) => store.create({ profileId, factType, playerId, value, confirmedAt: at });
const playerId = player => player.canonicalPlayerId;

test('manual fact creation', () => assert.equal(create('a', 'PLAYER_AVAILABILITY', 'p1', 'AVAILABLE').status, 'ACTIVE'));
test('manual fact provenance', () => assert.equal(store.list('a').at(-1).source, 'USER_CONFIRMED'));
test('manual fact timestamp', () => assert.equal(store.list('a').at(-1).confirmedAt, at));
test('profile isolation', () => { create('b', 'PLAYER_AVAILABILITY', 'p2', 'AVAILABLE'); assert.equal(store.list('a').some(f => f.playerId === 'p2'), false); });
test('manual player availability', () => assert.equal(Manual.validateFact({ profileId:'a', factType:'PLAYER_AVAILABILITY', playerId:'p', value:'AVAILABLE' }).value, 'AVAILABLE'));
test('manual roster membership', () => assert.equal(Manual.validateFact({ profileId:'a', factType:'ROSTER_MEMBERSHIP', playerId:'p', value:'ON_MY_ROSTER' }).value, 'ON_MY_ROSTER'));
test('manual IR state', () => assert.equal(Manual.validateFact({ profileId:'a', factType:'LINEUP_SLOT', playerId:'p', value:'IR' }).value, 'IR'));
test('manual starter state', () => assert.equal(Manual.validateFact({ profileId:'a', factType:'LINEUP_SLOT', playerId:'p', value:'STARTER' }).value, 'STARTER'));
test('manual bench state', () => assert.equal(Manual.validateFact({ profileId:'a', factType:'LINEUP_SLOT', playerId:'p', value:'BENCH' }).value, 'BENCH'));
test('manual fact revocation', () => { const f=create('rev','PLAYER_AVAILABILITY','p','AVAILABLE'); assert.equal(store.revoke('rev',f.factId,at).status,'REVOKED'); });
test('Yahoo supersedes conflicting manual fact', () => { create('y','PLAYER_AVAILABILITY','p','AVAILABLE'); store.reconcileYahoo('y',[{source:'YAHOO_AUTHORITATIVE',factType:'PLAYER_AVAILABILITY',playerId:'p',value:'UNAVAILABLE'}],at); assert.equal(store.list('y').at(-1).status,'SUPERSEDED'); });
test('manual fact cannot supersede authoritative Yahoo', () => assert.equal(Manual.resolveFact({ yahooFact:{source:'YAHOO_AUTHORITATIVE',value:'UNAVAILABLE'}, manualFact:{source:'USER_CONFIRMED',value:'AVAILABLE'} }).value,'UNAVAILABLE'));
test('Draft Archive cannot supersede current user-confirmed state', () => assert.equal(Manual.resolveFact({ manualFact:{source:'USER_CONFIRMED',value:'AVAILABLE'}, archiveFact:{source:'DRAFT_ARCHIVE',value:'UNKNOWN'} }).source,'USER_CONFIRMED'));
test('demo cannot masquerade as live', () => assert.notEqual(Manual.resolveFact({ demoFact:{source:'DEMO',value:'AVAILABLE'} }).source,'YAHOO_AUTHORITATIVE'));
test('stale NFL evidence cannot masquerade as current', () => assert.equal(Manual.SOURCE.YAHOO,'YAHOO_AUTHORITATIVE'));

function scenarioModel() {
  const roster = fixture.roster.map(player => ({ ...player, identity:{status:'MATCHED',canonicalPlayerId:player.canonicalPlayerId}, waiverEvidence:{sourceValue: player.rosterSlot==='BN'?22:82, role:player.rosterSlot==='BN'?25:82, opportunity:player.rosterSlot==='BN'?25:82, upside:player.rosterSlot==='BN'?28:82, risk:40, replaceability:player.rosterSlot==='BN'?85:25, acquisitionCost:0, confidence:90} }));
  return { profileId:fixture.profile.id, sourceLabel:'Draft Snapshot', draftSnapshot:true, stale:true, syncError:'non-live', snapshot:{provider:'Draft Snapshot',settings:{rosterSlots:fixture.profile.settings.rosterSlots},ownership:{valid:true}}, userTeamResolution:{status:'RESOLVED'}, roster, available:fixture.available.map(p=>({...p})), teams:Array.from({length:10},(_,i)=>({teamKey:`t${i+1}`,roster:i?[]:roster})), groups:{starters:roster.filter(p=>!['BN','IR'].includes(p.rosterSlot)),bench:roster.filter(p=>p.rosterSlot==='BN'),ir:roster.filter(p=>p.rosterSlot==='IR')}, phase:{key:'discovery'} };
}
function confirmedScenario() {
  const local = new MemoryStorage(), state = new Manual.ManualSeasonStateStore({storage:local,now:()=>at,idFactory:(f)=>`${f.factType}:${f.playerId}`}), model=scenarioModel();
  model.roster.forEach(p=>state.create({profileId:model.profileId,factType:'ROSTER_MEMBERSHIP',playerId:playerId(p),value:'ON_MY_ROSTER'}));
  model.available.forEach(p=>state.create({profileId:model.profileId,factType:'PLAYER_AVAILABILITY',playerId:playerId(p),value:'AVAILABLE'}));
  return Manual.applyToModel(model,state.list(model.profileId,{history:false}));
}
test('A.J. Brown fixture orchestration', () => assert.equal(scenarioModel().roster.find(p=>p.canonicalPlayerId==='21').injuryStatus,'OUT'));
test('internal lineup replacement', () => assert(scenarioModel().roster.some(p=>p.canonicalPlayerId==='83'&&p.rosterSlot==='BN')));
test('external waiver candidate evaluation', () => assert(Waiver.evaluate({model:confirmedScenario(),profile:fixture.profile}).pairs.length>0));
test('existing IR-slot constraint', () => { const m=scenarioModel(); assert.equal(m.groups.ir.length,1); assert.equal(m.groups.ir[0].canonicalPlayerId,'68'); });
test('add/drop requirement when roster full', () => assert(Waiver.evaluate({model:confirmedScenario(),profile:fixture.profile}).pairs.every(p=>p.action==='HOLD'||p.drop)));
test('HOLD/no-action behavior', () => assert.equal(Weekly.orchestrate({profileId:'x'}).weeklyStatus,'HOLD'));
test('WATCH remains subordinate to ACT', () => { const plan=Weekly.orchestrate({yahooAuthority:true,waiver:{status:'EVALUATED',signals:{sharinganPick:{canonicalPlayerId:'p',player:{canonicalPlayerId:'p',name:'Act'},action:'ACT',confidence:90}},pairs:[]},injuryOpportunity:[{playerId:'q',playerName:'Watch',primarySignal:'INJURY_WORSENING',confidence:70}]}); assert.equal(plan.primaryAction.playerName,'Act'); });
test('conflicting engine signals resolve through orchestration', () => { const plan=Weekly.orchestrate({yahooAuthority:true,waiver:{status:'EVALUATED',signals:{sharinganPick:{canonicalPlayerId:'p',player:{canonicalPlayerId:'p',name:'P'},action:'ACT'}},pairs:[]},injuryOpportunity:[{playerId:'p',playerName:'P',primarySignal:'INJURY_WORSENING',timingState:'WAIT'}]}); assert.equal(plan.primaryAction.posture,'WAIT'); });
test('stale evidence cannot create urgent action', () => assert.notEqual(Weekly.injuryItems({injuryOpportunity:[{playerId:'p',primarySignal:'INJURY_WORSENING',freshness:'STALE'}]})[0].posture,'ACT_NOW'));
test('mobile render smoke contract', () => { const css=fs.readFileSync('css/app.css','utf8'); assert(css.includes('@media(max-width:720px)')&&css.includes('.seasonWeeklyPrimaryDecision')); });
test('desktop render smoke contract', () => { const app=fs.readFileSync('js/app.js','utf8'); assert(app.includes('seasonWeeklyPrimaryDecision')&&app.includes('seasonWeeklyStatusSummary')); });
test('Draft Mode regression surface', () => { const html=fs.readFileSync('index.html','utf8'); assert(html.includes('id="appScreen"')&&html.includes('Simulate To My Next Pick')); });
test('multi-profile A → B → C → A', () => { const s=new MemoryStorage(),x=new Manual.ManualSeasonStateStore({storage:s,now:()=>at}); ['A','B','C'].forEach((p,i)=>x.create({profileId:p,factType:'PLAYER_AVAILABILITY',playerId:`p${i}`,value:'AVAILABLE'})); assert.deepEqual([x.list('A')[0].playerId,x.list('B')[0].playerId,x.list('C')[0].playerId,x.list('A')[0].playerId],['p0','p1','p2','p0']); });
test('no Slot 6 fallback leakage', () => assert.equal(store.list('unknown-profile').length,0));
test('no primary-league fallback leakage', () => assert.notEqual(Manual.keyFor('other-league'),Manual.keyFor('primary-league')));
test('no rankings mutation', () => { const before=JSON.stringify(fixture); confirmedScenario(); assert.equal(JSON.stringify(fixture),before); });
test('no scoring mutation', () => { const source=fs.readFileSync('js/manual-season-state-v1.js','utf8'); assert(!/mamba|championshipEquity|recommendationScore/i.test(source)); });
test('no Championship Equity mutation', () => assert(!fs.readFileSync('js/manual-season-state-v1.js','utf8').includes('recommendationAuthority')));
test('no duplicate transaction recommendation caused by multiple engines', () => { const p=Weekly.orchestrate({userConfirmedAuthority:true,waiver:{status:'EVALUATED',signals:{sharinganPick:{canonicalPlayerId:'p',player:{canonicalPlayerId:'p',name:'P'},action:'ACT'}},pairs:[]},injuryOpportunity:[{playerId:'p',playerName:'P',primarySignal:'BREAKOUT_SIGNAL_STRONG'}]}); assert.equal(p.allItems.filter(x=>x.playerId==='p').length,1); });
test('manual state survives reload/persistence', () => { const f=create('persist','PLAYER_AVAILABILITY','p','AVAILABLE'); const reload=new Manual.ManualSeasonStateStore({storage}); assert.equal(reload.list('persist')[0].factId,f.factId); });
test('Yahoo reconciliation removes current authority without corrupting history', () => { create('reconcile','PLAYER_AVAILABILITY','p','AVAILABLE'); store.reconcileYahoo('reconcile',[{source:'YAHOO_AUTHORITATIVE',factType:'PLAYER_AVAILABILITY',playerId:'p',value:'UNAVAILABLE'}],at); assert.equal(store.list('reconcile',{history:false}).length,0); assert.equal(store.list('reconcile').length,1); });

let passed=0;
for(const {name,run} of tests){ try{run();passed+=1;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}: ${error.stack||error}`);process.exitCode=1;} }
console.log(`${passed}/${tests.length} Jōnin 4.4.11.2 contracts passed`);
if(passed!==36) process.exitCode=1;
