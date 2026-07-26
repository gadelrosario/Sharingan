'use strict';
const Core=require('../js/intelligence-core');

async function run(){
  const results=[];
  const test=async(name,fn)=>{try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}};
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const C=Core.canonical;

  await test('canonical player owns primary ID',()=>assert(C.createPlayer({playerId:'fhq_nfl_1',name:'Player',position:'RB'}).playerId==='fhq_nfl_1','canonical ID lost'));
  await test('provider IDs remain secondary',()=>{const p=C.createPlayer({playerId:'fhq_nfl_1',name:'Player',position:'RB',yahooId:22,sleeperId:'s1'});assert(p.externalIds.yahoo==='22'&&p.externalIds.sleeper==='s1','external IDs not normalized');});
  await test('future provider IDs require no schema change',()=>assert(C.createPlayer({playerId:'fhq_nfl_1',name:'Player',position:'RB',externalIds:{future:'f1'}}).externalIds.future==='f1','future ID lost'));
  await test('invalid canonical ID rejected',()=>{let threw=false;try{C.createPlayer({playerId:'yahoo_1',name:'Player',position:'RB'});}catch(_){threw=true;}assert(threw,'invalid ID accepted');});
  await test('defense variants normalize',()=>assert(C.createPlayer({playerId:'fhq_nfl_dst',name:'Defense',position:'Defense'}).position==='DST','defense not normalized'));
  await test('all ten canonical entities exposed',()=>assert(C.ENTITY_TYPES.length===10,'entity count changed'));
  await test('team entity valid',()=>assert(C.createTeam({teamId:'fhq_team_buf',name:'Buffalo',abbreviation:'buf'}).abbreviation==='BUF','team invalid'));
  await test('league entity keeps settings',()=>assert(C.createLeague({leagueId:'fhq_league_1',name:'League',season:2026,settings:{teams:10}}).settings.teams===10,'settings lost'));
  await test('manager entity valid',()=>assert(C.createManager({managerId:'fhq_manager_1',displayName:'Manager'}).displayName==='Manager','manager invalid'));
  await test('roster references canonical players',()=>assert(C.createRoster({rosterId:'fhq_roster_1',leagueId:'fhq_league_1',managerId:'fhq_manager_1',playerIds:['fhq_nfl_1'],season:2026}).playerIds.length===1,'roster invalid'));
  await test('draft pick retains order',()=>assert(C.createDraftPick({draftPickId:'fhq_pick_1',leagueId:'fhq_league_1',rosterId:'fhq_roster_1',playerId:'fhq_nfl_1',overall:10,round:1,selectedAt:'2026-07-25T00:00:00Z'}).overall===10,'pick invalid'));
  await test('invalid numeric fields rejected',()=>{let threw=false;try{C.createDraftPick({draftPickId:'fhq_pick_1',leagueId:'fhq_league_1',rosterId:'fhq_roster_1',playerId:'fhq_nfl_1',overall:'unknown',round:1,selectedAt:'2026-07-25T00:00:00Z'});}catch(_){threw=true;}assert(threw,'invalid pick accepted');});
  await test('projection links evidence',()=>assert(C.createProjection({projectionId:'fhq_projection_1',playerId:'fhq_nfl_1',season:2026,scoringFormat:'half',metrics:{points:200},evidenceId:'fhq_evidence_1'}).evidenceId==='fhq_evidence_1','evidence link lost'));
  await test('market snapshot is timestamped',()=>assert(C.createMarketSnapshot({marketSnapshotId:'fhq_market_1',playerId:'fhq_nfl_1',market:'ADP',values:{adp:12},capturedAt:'2026-07-25T00:00:00Z'}).values.adp===12,'market invalid'));

  const Provider=Core.providers.YahooProvider,provider=new Provider({records:[{externalId:'y1'}],confidence:'MODERATE'});
  await test('mock provider initializes',async()=>assert((await provider.initialize()).status==='READY','not ready'));
  await test('mock provider syncs without network',async()=>{const result=await provider.sync({timestamp:'2026-07-25T00:00:00Z'});assert(result.mock&&result.records[0].provider==='Yahoo','mock sync invalid');});
  await test('provider exposes last updated',()=>assert(provider.getLastUpdated()==='2026-07-25T00:00:00Z','last update missing'));
  await test('provider exposes confidence',()=>assert(provider.getConfidence()==='MODERATE','confidence missing'));
  await test('all required placeholder providers exist',()=>assert(['YahooProvider','SleeperProvider','OddsProvider','StatsProvider','InjuryProvider','ExpertRegistryProvider'].every(key=>typeof Core.providers[key]==='function'),'provider missing'));

  const now={value:'2026-07-25T12:00:00Z'},evidence=new Core.evidence.EvidenceEngine({now:()=>now.value,defaultMaxAgeMs:3600000});
  const record=evidence.record({evidenceId:'fhq_evidence_1',subjectType:'Player',subjectId:'fhq_nfl_1',metric:'Target Share',value:.24,source:'MockStats',timestamp:'2026-07-25T11:30:00Z',confidence:'HIGH',reliability:'PRIMARY'});
  await test('evidence stores required metadata',()=>assert(record.source==='MockStats'&&record.freshness==='FRESH'&&record.confidence==='HIGH'&&record.reliability==='PRIMARY','metadata missing'));
  await test('freshness ages deterministically',()=>{now.value='2026-07-25T13:31:00Z';assert(evidence.assess('fhq_evidence_1').freshness==='STALE','freshness not aged');});
  await test('evidence subject lookup',()=>assert(evidence.forSubject('fhq_nfl_1').length===1,'subject lookup failed'));
  await test('invalid confidence rejected',()=>{let threw=false;try{evidence.record({evidenceId:'fhq_evidence_2',subjectType:'Player',subjectId:'fhq_nfl_1',metric:'Risk',value:1,source:'Mock',timestamp:'2026-07-25T12:00:00Z',confidence:'CERTAIN',reliability:'PRIMARY'});}catch(_){threw=true;}assert(threw,'invalid confidence accepted');});

  const store=new Core.intelligence.IntelligenceStore();
  await test('player intelligence fields persist',()=>assert(store.upsertPlayer('fhq_nfl_1',{opportunity:'HIGH',risk:'LOW',lastUpdated:'2026-07-25T00:00:00Z'}).opportunity==='HIGH','player intelligence lost'));
  await test('team intelligence fields persist',()=>assert(store.upsertTeam('fhq_team_buf',{offensiveEnvironment:'GOOD',qbStability:'HIGH'}).qbStability==='HIGH','team intelligence lost'));
  await test('unknown intelligence fields rejected',()=>{let threw=false;try{store.upsertPlayer('fhq_nfl_1',{recommendationScore:99});}catch(_){threw=true;}assert(threw,'scoring field accepted');});
  await test('store snapshot is provider neutral',()=>assert(store.snapshot().players[0].playerId==='fhq_nfl_1','snapshot invalid'));

  const registry=new Core.experts.ExpertStrategyRegistry();
  const signal=registry.register({signalId:'fhq_signal_1',playerId:'fhq_nfl_1',sourceId:'bdge',sourceType:'expert_transcript',category:'PRICE_FADE',scope:'PLAYER',strength:75,confidence:80,effectiveDate:'2026-07-01T00:00:00Z',expirationDate:'2026-08-01T00:00:00Z',supportingNotes:['Mock only'],sourceReference:'tests/intelligence-core-tests.js',provenance:{originalSource:'bdge',transcriptIdentifier:'fixture',localReference:'tests/intelligence-core-tests.js',dateCodified:'2026-07-25T00:00:00Z',evidenceType:'test_fixture',claimType:'summarized'}});
  await test('expert signal remains separate',()=>assert(signal.category==='PRICE_FADE'&&signal.entityType==='ExpertSignal','signal invalid'));
  await test('registry filters active signals',()=>assert(registry.find({source:'BDGE',activeAt:'2026-07-25T00:00:00Z'}).length===1,'active filter failed'));
  await test('registry expires signals',()=>assert(registry.find({activeAt:'2026-09-01T00:00:00Z'}).length===0,'expiration failed'));

  const logs=[],logger={info:message=>logs.push(message),error:message=>logs.push(message)},mission=new Core.missionControl.MissionControl({clock:()=> '2026-07-25T00:00:00Z',logger});
  mission.registerProvider(provider,{nextScheduledSync:'2026-07-26T00:00:00Z'});
  await test('Mission Control tracks provider status',()=>assert(mission.getProviderHealth('Yahoo').providerStatus==='READY','health missing'));
  await test('Mission Control queues refreshes',()=>{mission.schedule('Yahoo','2026-07-25T01:00:00Z');assert(mission.getStatus().refreshQueue.length===1,'queue missing');});
  await test('Mission Control tracks next scheduled sync',()=>assert(mission.getProviderHealth('Yahoo').nextScheduledSync==='2026-07-25T01:00:00Z','next sync missing'));
  await test('Mission Control processes refresh queue',async()=>{await mission.processNext();assert(mission.getStatus().refreshQueue.length===0,'queue not processed');});
  await test('Mission Control records successful sync',()=>assert(mission.getProviderHealth('Yahoo').lastSuccessfulSync==='2026-07-25T01:00:00Z','success time missing'));
  await test('Mission Control logs through injection',()=>assert(logs.some(line=>line.includes('succeeded')),'log missing'));
  await test('Mission Control tracks failures',async()=>{const failing=new Core.providers.InjuryProvider();failing.validate=()=>false;mission.registerProvider(failing);let threw=false;try{await mission.refresh('Injury');}catch(_){threw=true;}assert(threw&&mission.getProviderHealth('Injury').syncFailures===1&&mission.getProviderHealth('Injury').lastSuccessfulSync===null,'failure state missing');});
  await test('core has no recommendation surface',()=>assert(!Object.keys(Core).includes('recommendations')&&!Object.keys(Core).includes('mambaScore'),'runtime logic leaked into core'));

  const failCount=results.filter(result=>!result.passed).length;
  console.log(`Intelligence Core: ${results.length-failCount} passed, ${failCount} failed`);
  results.filter(result=>!result.passed).forEach(result=>console.error(`FAIL: ${result.name}: ${result.error}`));
  return {results,passCount:results.length-failCount,failCount};
}

if(require.main===module)run().then(result=>{if(result.failCount)process.exitCode=1;});
module.exports={run};
