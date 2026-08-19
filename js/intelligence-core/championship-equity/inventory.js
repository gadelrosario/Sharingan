'use strict';
const Contract=require('./contract');
const PLACEHOLDERS=new Set(['','pending','unknown','tbd','n/a','none']);
const usable=value=>value!==undefined&&value!==null&&!PLACEHOLDERS.has(String(value).trim().toLowerCase());
const count=(players,predicate)=>players.filter(predicate).length;
function audit(players=[],injurySnapshot={},intake={}){
  const injuryById=new Map((injurySnapshot.records||[]).map(record=>[String(record.playerId),record]));
  const contextById=new Map((intake.contextSnapshot?.records||[]).map(record=>[String(record.canonicalPlayerId),record]));
  const projectionIds=new Set((intake.projectionSnapshot?.projections||[]).map(record=>String(record.canonicalPlayerId)));
  const adpIds=new Set((intake.projectionSnapshot?.markets||[]).filter(record=>record.status==='AVAILABLE').map(record=>String(record.canonicalPlayerId)));
  const usageById=new Map((intake.historicalSnapshot?.players||[]).map(record=>[String(record.canonicalPlayerId),record]));
  const advanced=Object.values(Contract.POSITION_SIGNALS).flat().filter(field=>!['age','experience','draftCapital','depthChartPosition','starterAhead'].includes(field));
  const hasOpportunity=player=>usable(player.opportunityTrend)&&!PLACEHOLDERS.has(String(player.opportunityTrend).trim().toLowerCase());
  const value=(player,field)=>contextById.get(String(player.id))?.[field]??player[field];
  const hasSleeperId=player=>usable(player.sleeperId)||usable(player.externalIds?.sleeper)||usable(injuryById.get(String(player.id))?.sourcePlayerId);
  const hasNflverseId=player=>usable(player.gsisId)||usable(player.nflverseId)||usable(player.nflId)||usable(player.externalIds?.gsis)||usable(player.externalIds?.nflverse)||usable(player.externalIds?.nfl);
  const coverageFor=group=>Object.freeze({
    players:group.length,
    sleeperIds:count(group,hasSleeperId),
    nflverseIds:count(group,hasNflverseId),
    age:count(group,player=>usable(value(player,'age'))),
    experience:count(group,player=>usable(value(player,'experience'))||usable(player.year)||usable(player.yearsExperience)),
    depthChartPosition:count(group,player=>usable(value(player,'depthChartPosition'))),
    depthChartOrder:count(group,player=>usable(value(player,'depthChartOrder'))),
    injuries:count(group,player=>injuryById.has(String(player.id))),
    projections:count(group,player=>projectionIds.has(String(player.id))),
    adp:count(group,player=>adpIds.has(String(player.id))),
    historicalUsage:count(group,player=>usageById.has(String(player.id))),
  });
  const skillPositions=['QB','RB','WR','TE'];
  return Object.freeze({
    generatedAt:null,totalPlayers:players.length,
    positionCounts:Object.freeze(Object.fromEntries(['RB','WR','TE','QB','K','DST'].map(position=>[position,count(players,player=>(player.pos??player.position)===position)]))),
    coverage:Object.freeze({
      sleeperIds:count(players,hasSleeperId),
      nflverseIds:count(players,hasNflverseId),
      age:count(players,player=>usable(value(player,'age'))),
      experience:count(players,player=>usable(value(player,'experience'))||usable(player.year)||usable(player.yearsExperience)),
      rookie:count(players,player=>player.rookie===true),
      nflTeam:count(players,player=>usable(player.team??player.nflTeam)),
      position:count(players,player=>usable(player.pos??player.position)),
      externalIds:count(players,player=>hasSleeperId(player)||usable(player.yahooId)||usable(player.nflId)),
      depthChartPosition:count(players,player=>usable(value(player,'depthChartPosition'))),
      depthChartOrder:count(players,player=>usable(value(player,'depthChartOrder'))),
      handcuffRelationships:count(players,player=>Array.isArray(player.handcuffFor)&&player.handcuffFor.length>0),
      opportunityTrend:count(players,hasOpportunity),
      skillOpportunityTrend:count(players,player=>skillPositions.includes(player.pos??player.position)&&hasOpportunity(player)),
      advancedUsage:count(players,player=>advanced.some(field=>usable(player[field]))),
      projections:count(players,player=>projectionIds.has(String(player.id))),
      adp:count(players,player=>adpIds.has(String(player.id))),
      historicalUsage:count(players,player=>usageById.has(String(player.id))),
      injury:count(players,player=>injuryById.has(String(player.id))),
      overallRank:count(players,player=>Number(player.fantasylandOverallRank)>0),
      overallTier:count(players,player=>usable(player.fantasylandOverallTier)),
      positionalRank:count(players,player=>Number(player.fantasylandPositionRank)>0),
      expertConviction:count(players,player=>player.leagueBreaker===true||player.coreTarget===true||player.priceFade===true),
    }),
    byPosition:Object.freeze(Object.fromEntries(skillPositions.map(position=>[position,coverageFor(players.filter(player=>(player.pos??player.position)===position))]))),
    usageCoverage:Object.freeze({
      QB:Object.freeze({passing:count(players,player=>{const row=usageById.get(String(player.id));return(player.pos??player.position)==='QB'&&row?.stats?.passAttempts!==null&&row?.stats?.passAttempts!==undefined}),rushing:count(players,player=>{const row=usageById.get(String(player.id));return(player.pos??player.position)==='QB'&&row?.stats?.rushingAttempts!==null&&row?.stats?.rushingAttempts!==undefined}),scrambles:count(players,player=>(player.pos??player.position)==='QB'&&usageById.get(String(player.id))?.stats?.scrambles!==null&&usageById.get(String(player.id))?.stats?.scrambles!==undefined),designedRushes:count(players,player=>(player.pos??player.position)==='QB'&&usageById.get(String(player.id))?.stats?.designedRushes!==null&&usageById.get(String(player.id))?.stats?.designedRushes!==undefined),redZoneRushing:count(players,player=>(player.pos??player.position)==='QB'&&usageById.get(String(player.id))?.stats?.redZoneRushingAttempts!==null&&usageById.get(String(player.id))?.stats?.redZoneRushingAttempts!==undefined),efficiency:count(players,player=>(player.pos??player.position)==='QB'&&(usageById.get(String(player.id))?.derivedMetrics||[]).some(metric=>metric.metric==='yardsPerAttempt'))}),
      RB:Object.freeze({rushing:count(players,player=>(player.pos??player.position)==='RB'&&usageById.get(String(player.id))?.stats?.rushingAttempts!==null&&usageById.get(String(player.id))?.stats?.rushingAttempts!==undefined),receiving:count(players,player=>(player.pos??player.position)==='RB'&&usageById.get(String(player.id))?.stats?.targets!==null&&usageById.get(String(player.id))?.stats?.targets!==undefined),routes:count(players,player=>(player.pos??player.position)==='RB'&&usageById.get(String(player.id))?.stats?.routes!==null&&usageById.get(String(player.id))?.stats?.routes!==undefined),redZone:count(players,player=>(player.pos??player.position)==='RB'&&usageById.get(String(player.id))?.stats?.redZoneRushingAttempts!==null&&usageById.get(String(player.id))?.stats?.redZoneRushingAttempts!==undefined),goalLine:count(players,player=>(player.pos??player.position)==='RB'&&usageById.get(String(player.id))?.stats?.goalLineCarries!==null&&usageById.get(String(player.id))?.stats?.goalLineCarries!==undefined),trends:count(players,player=>(player.pos??player.position)==='RB'&&(usageById.get(String(player.id))?.trends||[]).some(trend=>trend.status==='EVIDENCE_PRESENT'))}),
      WR:Object.freeze({targets:count(players,player=>(player.pos??player.position)==='WR'&&usageById.get(String(player.id))?.stats?.targets!==null&&usageById.get(String(player.id))?.stats?.targets!==undefined),routes:count(players,player=>(player.pos??player.position)==='WR'&&usageById.get(String(player.id))?.stats?.routes!==null&&usageById.get(String(player.id))?.stats?.routes!==undefined),tprr:count(players,player=>(player.pos??player.position)==='WR'&&(usageById.get(String(player.id))?.derivedMetrics||[]).some(metric=>metric.metric==='tprr')),yprr:count(players,player=>(player.pos??player.position)==='WR'&&(usageById.get(String(player.id))?.derivedMetrics||[]).some(metric=>metric.metric==='yprr')),redZone:count(players,player=>(player.pos??player.position)==='WR'&&usageById.get(String(player.id))?.stats?.redZoneTargets!==null&&usageById.get(String(player.id))?.stats?.redZoneTargets!==undefined),trends:count(players,player=>(player.pos??player.position)==='WR'&&(usageById.get(String(player.id))?.trends||[]).some(trend=>trend.status==='EVIDENCE_PRESENT'))}),
      TE:Object.freeze({targets:count(players,player=>(player.pos??player.position)==='TE'&&usageById.get(String(player.id))?.stats?.targets!==null&&usageById.get(String(player.id))?.stats?.targets!==undefined),routes:count(players,player=>(player.pos??player.position)==='TE'&&usageById.get(String(player.id))?.stats?.routes!==null&&usageById.get(String(player.id))?.stats?.routes!==undefined),tprr:count(players,player=>(player.pos??player.position)==='TE'&&(usageById.get(String(player.id))?.derivedMetrics||[]).some(metric=>metric.metric==='tprr')),yprr:count(players,player=>(player.pos??player.position)==='TE'&&(usageById.get(String(player.id))?.derivedMetrics||[]).some(metric=>metric.metric==='yprr')),redZone:count(players,player=>(player.pos??player.position)==='TE'&&usageById.get(String(player.id))?.stats?.redZoneTargets!==null&&usageById.get(String(player.id))?.stats?.redZoneTargets!==undefined),trends:count(players,player=>(player.pos??player.position)==='TE'&&(usageById.get(String(player.id))?.trends||[]).some(trend=>trend.status==='EVIDENCE_PRESENT'))}),
    }),
    intakeQuality:Object.freeze({contextMatched:intake.contextSnapshot?.matched??0,contextUnmatched:intake.contextSnapshot?.unmatchedCount??0,contextAmbiguous:intake.contextSnapshot?.ambiguousCount??0,contextQuarantined:intake.contextSnapshot?.quarantinedCount??0,projectionQuarantined:intake.projectionSnapshot?.quarantined?.length??0,usageMatched:intake.historicalSnapshot?.identityQuality?.matchedPlayers??0,usageUnmatched:intake.historicalSnapshot?.identityQuality?.unmatched??0,usageAmbiguous:intake.historicalSnapshot?.identityQuality?.ambiguous??0,usageQuarantined:intake.historicalSnapshot?.identityQuality?.quarantined??0}),
  });
}
module.exports=Object.freeze({PLACEHOLDERS,usable,audit});
