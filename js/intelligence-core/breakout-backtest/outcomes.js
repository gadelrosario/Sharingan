'use strict';

const SCORING=Object.freeze({
  id:'HALF_PPR_4PT_PASS_TD',
  passingYards:0.04,
  passingTouchdowns:4,
  interceptions:-2,
  rushingYards:0.1,
  rushingTouchdowns:6,
  receptions:0.5,
  receivingYards:0.1,
  receivingTouchdowns:6,
});

const OUTCOME_THRESHOLDS=Object.freeze({
  QB:Object.freeze({elitePercentile:0.85,starterPercentile:0.60}),
  RB:Object.freeze({elitePercentile:0.90,starterPercentile:0.65}),
  WR:Object.freeze({elitePercentile:0.90,starterPercentile:0.65}),
  TE:Object.freeze({elitePercentile:0.85,starterPercentile:0.60}),
});

const LABELS=Object.freeze(['ELITE_OUTCOME','STARTER_BREAKOUT','MEANINGFUL_ASCENT','NON_BREAKOUT']);
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const games=record=>Number(record?.sample?.weeksObserved)||0;

function fantasyPoints(record,scoring=SCORING){
  const stats=record?.stats||{};
  return finite(stats.passingYards)*scoring.passingYards+
    finite(stats.passingTouchdowns)*scoring.passingTouchdowns+
    finite(stats.interceptions)*scoring.interceptions+
    finite(stats.rushingYards)*scoring.rushingYards+
    finite(stats.rushingTouchdowns)*scoring.rushingTouchdowns+
    finite(stats.receptions)*scoring.receptions+
    finite(stats.receivingYards)*scoring.receivingYards+
    finite(stats.receivingTouchdowns)*scoring.receivingTouchdowns;
}

function seasonOutcomeValue(record,scoring=SCORING){
  const sampleGames=games(record),points=fantasyPoints(record,scoring);
  return Object.freeze({
    canonicalPlayerId:String(record.canonicalPlayerId),
    position:record.position,
    season:record.season,
    games:sampleGames,
    fantasyPoints:points,
    fantasyPointsPerGame:sampleGames?points/sampleGames:null,
    scoringBasis:scoring.id,
  });
}

function percentile(value,values){
  if(!Number.isFinite(value)||!values.length)return null;
  const finiteValues=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!finiteValues.length)return null;
  if(finiteValues.length===1)return 1;
  const below=finiteValues.filter(item=>item<value).length;
  const equal=finiteValues.filter(item=>item===value).length;
  return (below+(equal-1)/2)/(finiteValues.length-1);
}

function buildSeasonDistributions(records=[],{minimumGames=8,scoring=SCORING}={}){
  const groups=new Map();
  for(const record of records){
    const outcome=seasonOutcomeValue(record,scoring);
    if(outcome.games<minimumGames||outcome.fantasyPointsPerGame===null)continue;
    const key=`${outcome.position}|${outcome.season}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(outcome.fantasyPointsPerGame);
  }
  return groups;
}

function classifyOutcome({featureRecord,outcomeRecord,distributions,minimumEvidenceGames=8,minimumOutcomeGames=8,scoring=SCORING}={}){
  if(!featureRecord||!outcomeRecord)throw new TypeError('feature and outcome records are required');
  if(String(featureRecord.canonicalPlayerId)!==String(outcomeRecord.canonicalPlayerId))throw new TypeError('outcome identity must match feature identity');
  if(outcomeRecord.season!==featureRecord.season+1)throw new TypeError('outcome season must immediately follow evidence season');
  if(featureRecord.position!==outcomeRecord.position)throw new TypeError('position must remain stable across the backtest pair');
  const position=featureRecord.position,thresholds=OUTCOME_THRESHOLDS[position];
  if(!thresholds)throw new TypeError(`unsupported position ${position}`);
  const prior=seasonOutcomeValue(featureRecord,scoring),outcome=seasonOutcomeValue(outcomeRecord,scoring);
  const priorValues=distributions.get(`${position}|${featureRecord.season}`)||[];
  const outcomeValues=distributions.get(`${position}|${outcomeRecord.season}`)||[];
  const priorPercentile=percentile(prior.fantasyPointsPerGame,priorValues),outcomePercentile=percentile(outcome.fantasyPointsPerGame,outcomeValues);
  if(prior.games<minimumEvidenceGames||outcome.games<minimumOutcomeGames||priorPercentile===null||outcomePercentile===null)return Object.freeze({status:'INSUFFICIENT_SAMPLE',label:null,isBreakout:null,eligibleForBreakout:null,prior,outcome,priorPercentile,outcomePercentile,percentileGain:null,thresholds});
  const gain=outcomePercentile-priorPercentile;
  let label='NON_BREAKOUT';
  if(outcomePercentile>=thresholds.elitePercentile&&priorPercentile<thresholds.elitePercentile&&gain>=0.10)label='ELITE_OUTCOME';
  else if(outcomePercentile>=thresholds.starterPercentile&&priorPercentile<thresholds.starterPercentile&&gain>=0.10)label='STARTER_BREAKOUT';
  else if(outcomePercentile>=0.40&&gain>=0.20)label='MEANINGFUL_ASCENT';
  return Object.freeze({status:'LABELED',label,isBreakout:label!=='NON_BREAKOUT',eligibleForBreakout:priorPercentile<thresholds.elitePercentile,prior,outcome,priorPercentile,outcomePercentile,percentileGain:gain,thresholds});
}

module.exports=Object.freeze({SCORING,OUTCOME_THRESHOLDS,LABELS,fantasyPoints,seasonOutcomeValue,percentile,buildSeasonDistributions,classifyOutcome});
