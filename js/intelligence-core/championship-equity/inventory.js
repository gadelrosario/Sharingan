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
  const advanced=Object.values(Contract.POSITION_SIGNALS).flat().filter(field=>!['age','experience','draftCapital','depthChartPosition','starterAhead'].includes(field));
  const hasOpportunity=player=>usable(player.opportunityTrend)&&!PLACEHOLDERS.has(String(player.opportunityTrend).trim().toLowerCase());
  const value=(player,field)=>contextById.get(String(player.id))?.[field]??player[field];
  const hasSleeperId=player=>usable(player.sleeperId)||usable(player.externalIds?.sleeper)||usable(injuryById.get(String(player.id))?.sourcePlayerId);
  const coverageFor=group=>Object.freeze({
    players:group.length,
    sleeperIds:count(group,hasSleeperId),
    age:count(group,player=>usable(value(player,'age'))),
    experience:count(group,player=>usable(value(player,'experience'))||usable(player.year)||usable(player.yearsExperience)),
    depthChartPosition:count(group,player=>usable(value(player,'depthChartPosition'))),
    depthChartOrder:count(group,player=>usable(value(player,'depthChartOrder'))),
    injuries:count(group,player=>injuryById.has(String(player.id))),
    projections:count(group,player=>projectionIds.has(String(player.id))),
    adp:count(group,player=>adpIds.has(String(player.id))),
  });
  const skillPositions=['QB','RB','WR','TE'];
  return Object.freeze({
    generatedAt:null,totalPlayers:players.length,
    positionCounts:Object.freeze(Object.fromEntries(['RB','WR','TE','QB','K','DST'].map(position=>[position,count(players,player=>(player.pos??player.position)===position)]))),
    coverage:Object.freeze({
      sleeperIds:count(players,hasSleeperId),
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
      injury:count(players,player=>injuryById.has(String(player.id))),
      overallRank:count(players,player=>Number(player.fantasylandOverallRank)>0),
      overallTier:count(players,player=>usable(player.fantasylandOverallTier)),
      positionalRank:count(players,player=>Number(player.fantasylandPositionRank)>0),
      expertConviction:count(players,player=>player.leagueBreaker===true||player.coreTarget===true||player.priceFade===true),
    }),
    byPosition:Object.freeze(Object.fromEntries(skillPositions.map(position=>[position,coverageFor(players.filter(player=>(player.pos??player.position)===position))]))),
    intakeQuality:Object.freeze({contextMatched:intake.contextSnapshot?.matched??0,contextUnmatched:intake.contextSnapshot?.unmatchedCount??0,contextAmbiguous:intake.contextSnapshot?.ambiguousCount??0,contextQuarantined:intake.contextSnapshot?.quarantinedCount??0,projectionQuarantined:intake.projectionSnapshot?.quarantined?.length??0}),
  });
}
module.exports=Object.freeze({PLACEHOLDERS,usable,audit});
