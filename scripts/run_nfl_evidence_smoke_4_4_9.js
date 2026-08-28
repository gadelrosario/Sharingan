#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const evidence=require('../js/season-evidence-v1.js');
const registryModule=require('../js/season-player-registry-v1.js');
const injuryOpportunity=require('../js/injury-opportunity-intelligence-v1.js');
const ROOT=path.resolve(__dirname,'..');

const players=JSON.parse(fs.readFileSync(path.join(ROOT,'data/players.json'),'utf8'));
const artifact=JSON.parse(fs.readFileSync(path.join(ROOT,'data/season_evidence/nflverse_latest.json'),'utf8'));
const registryArtifact=JSON.parse(fs.readFileSync(path.join(ROOT,'data/season_evidence/season_player_registry.json'),'utf8'));
const registry=new registryModule.SeasonPlayerRegistry({artifact:registryArtifact}),seasonPlayers=registry.evidencePlayers(),allPlayers=[...players,...seasonPlayers];
if(seasonPlayers.some(player=>player.draftEligible||player.rank!=null||player.overall_tier!=null))throw new Error('Season registry contaminated Draft authority');
const store=new evidence.SeasonEvidenceStore({asOf:'2026-08-27T20:00:00.000Z'}),start=performance.now(),result=store.importPayload(artifact,{players:allPlayers}),importMs=performance.now()-start;
if(result.accepted!==artifact.recordCount||result.rejected)throw new Error(`artifact import mismatch: ${JSON.stringify(result)}`);
const before=JSON.stringify([...store.byPlayer.entries()]),repeat=store.importPayload(artifact,{players:allPlayers});
if(repeat.idempotent!==artifact.recordCount||JSON.stringify([...store.byPlayer.entries()])!==before)throw new Error('artifact import is not idempotent');
const engine=new injuryOpportunity.InjuryOpportunityIntelligence(store),evaluationStart=performance.now(),evaluations=engine.evaluateAll([...store.byPlayer.keys()],{phase:'DISCOVERY',limit:8}),evaluationMs=performance.now()-evaluationStart,status=store.status({yahooState:{authoritative:false,current:false}});
if(status.recommendationAuthority!==false||status.decisionAuthority!=='SHADOW')throw new Error('provider evidence escalated decision authority');
if(status.families.opportunity.status!=='STALE'||status.families.production.status!=='STALE')throw new Error('historical evidence did not remain stale');
console.log(JSON.stringify({status:'PASS',provider:artifact.provider,season:artifact.season,weeks:artifact.weeks,records:artifact.recordCount,players:status.players,canonicalPlayers:players.length,seasonRegistryPlayers:seasonPlayers.length,importMs:+importMs.toFixed(3),evaluationMs:+evaluationMs.toFixed(3),evaluations:evaluations.length,freshness:status.families.opportunity.freshness,recommendationAuthority:status.recommendationAuthority,draftContamination:0,idempotent:repeat.idempotent}));
