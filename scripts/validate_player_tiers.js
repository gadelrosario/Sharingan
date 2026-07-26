#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),tiers=require('../js/player-tier-contract.js');
const players=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/players.json'),'utf8'));
const records=players.map(tiers.getTierDiagnostic),count=predicate=>records.filter(predicate).length;
const decisionDomain=new Set(tiers.DOMAINS.decision);
const validOverallFallback=records.filter(record=>record.fallbackUsed&&!decisionDomain.has(String(record.positionTier||'').toUpperCase())&&decisionDomain.has(record.overallTier));
const compatibilityC=records.filter(record=>record.fallbackUsed&&!decisionDomain.has(String(record.positionTier||'').toUpperCase())&&!decisionDomain.has(record.overallTier)&&record.decisionTier==='C');
const summary={total:records.length,validPositionTiers:count(r=>r.positionTier!==null),validOverallTiers:count(r=>r.overallTier!==null),differingButValidTiers:count(r=>r.differingValidTiers),invalidPositionTiers:count(r=>r.invalidPositionTier),invalidOverallTiers:count(r=>r.invalidOverallTier),fallbackUsed:count(r=>r.fallbackUsed),validOverallFallbackUsed:validOverallFallback.length,compatibilityCUsed:compatibilityC.length,otherFallback:count(r=>r.fallbackUsed)-validOverallFallback.length-compatibilityC.length,unresolvedDecisionTiers:count(r=>r.decisionTier==null),specialTeamNumericTiers:count(r=>r.specialTeamNumericTier),depthTiers:count(r=>r.depthTier)};
console.log(JSON.stringify({summary,compatibilityCPlayers:compatibilityC,records},null,2));
