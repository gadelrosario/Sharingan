'use strict';

const WINDOW_CONTRACT=Object.freeze({
  fullSeason:'All Season N records aggregated by canonical player and position.',
  lateSeason:'Mean of the final two active observations available in Season N.',
  earlyVsLateGrowth:'Final-two mean minus the preceding-two mean, using only the final four active observations in Season N.',
});

const FEATURE_DEFINITIONS=Object.freeze({
  QB:Object.freeze([
    ['passAttemptsPerGame',1],['passingYardsPerGame',1],['passingTouchdownsPerGame',1],['completionRate',1],['yardsPerAttempt',1],['passingTouchdownRate',1],['interceptionRate',-1],
    ['rushingAttemptsPerGame',1],['rushingYardsPerGame',1],['rushingTouchdownsPerGame',1],['latePassingYards',1],['passingYardsGrowth',1],['lateRushingAttempts',1],['rushingAttemptGrowth',1],
  ]),
  RB:Object.freeze([
    ['rushingAttemptsPerGame',1],['rushingYardsPerGame',1],['rushingTouchdownsPerGame',1],['targetsPerGame',1],['receptionsPerGame',1],['receivingYardsPerGame',1],['receivingTouchdownsPerGame',1],['touchesPerGame',1],['yardsPerCarry',1],['yardsPerTarget',1],['touchdownRatePerTouch',1],['lateRushingAttempts',1],['rushingAttemptGrowth',1],['lateTargets',1],['targetGrowth',1],
  ]),
  WR:Object.freeze([
    ['targetsPerGame',1],['receptionsPerGame',1],['receivingYardsPerGame',1],['receivingTouchdownsPerGame',1],['yardsPerTarget',1],['receptionsPerTarget',1],['lateTargets',1],['targetGrowth',1],
  ]),
  TE:Object.freeze([
    ['targetsPerGame',1],['receptionsPerGame',1],['receivingYardsPerGame',1],['receivingTouchdownsPerGame',1],['yardsPerTarget',1],['receptionsPerTarget',1],['lateTargets',1],['targetGrowth',1],
  ]),
});

const numeric=value=>Number.isFinite(Number(value))?Number(value):null;
const divide=(numerator,denominator)=>Number.isFinite(numerator)&&Number.isFinite(denominator)&&denominator>0?numerator/denominator:null;
const derived=(record,metric)=>numeric(record?.derivedMetrics?.find(item=>item.metric===metric)?.value);
const trend=(record,metric)=>record?.trends?.find(item=>item.metric===metric&&item.status==='EVIDENCE_PRESENT')||null;
const average=rows=>rows?.length?rows.reduce((total,row)=>total+Number(row.value),0)/rows.length:null;

function extractFeatures(record,{evidenceSeason=record?.season}={}){
  if(!record)throw new TypeError('historical record is required');
  if(record.season!==evidenceSeason)throw new TypeError('feature extraction may only read the declared evidence season');
  const stats=record.stats||{},games=numeric(record.sample?.weeksObserved),position=record.position;
  const values={
    passAttemptsPerGame:divide(numeric(stats.passAttempts),games),
    passingYardsPerGame:divide(numeric(stats.passingYards),games),
    passingTouchdownsPerGame:divide(numeric(stats.passingTouchdowns),games),
    completionRate:derived(record,'completionRate'),
    yardsPerAttempt:derived(record,'yardsPerAttempt'),
    passingTouchdownRate:derived(record,'passingTouchdownRate'),
    interceptionRate:derived(record,'interceptionRate'),
    rushingAttemptsPerGame:divide(numeric(stats.rushingAttempts),games),
    rushingYardsPerGame:divide(numeric(stats.rushingYards),games),
    rushingTouchdownsPerGame:divide(numeric(stats.rushingTouchdowns),games),
    targetsPerGame:derived(record,'targetsPerGame'),
    receptionsPerGame:divide(numeric(stats.receptions),games),
    receivingYardsPerGame:divide(numeric(stats.receivingYards),games),
    receivingTouchdownsPerGame:divide(numeric(stats.receivingTouchdowns),games),
    touchesPerGame:derived(record,'touchesPerGame'),
    yardsPerCarry:divide(numeric(stats.rushingYards),numeric(stats.rushingAttempts)),
    yardsPerTarget:derived(record,'yardsPerTarget'),
    receptionsPerTarget:derived(record,'receptionsPerTarget'),
    touchdownRatePerTouch:divide((numeric(stats.rushingTouchdowns)||0)+(numeric(stats.receivingTouchdowns)||0),derived(record,'totalTouches')),
  };
  const trendMap={passingYards:trend(record,'passingYards'),rushingAttempts:trend(record,'rushingAttempts'),targets:trend(record,'targets')};
  values.latePassingYards=average(trendMap.passingYards?.recentWindow);
  values.passingYardsGrowth=numeric(trendMap.passingYards?.magnitude);
  values.lateRushingAttempts=average(trendMap.rushingAttempts?.recentWindow);
  values.rushingAttemptGrowth=numeric(trendMap.rushingAttempts?.magnitude);
  values.lateTargets=average(trendMap.targets?.recentWindow);
  values.targetGrowth=numeric(trendMap.targets?.magnitude);
  const definitions=FEATURE_DEFINITIONS[position];
  if(!definitions)throw new TypeError(`unsupported position ${position}`);
  return Object.freeze({
    canonicalPlayerId:String(record.canonicalPlayerId),position,evidenceSeason:record.season,
    windows:WINDOW_CONTRACT,
    values:Object.freeze(Object.fromEntries(definitions.map(([name])=>[name,values[name]??null]))),
  });
}

module.exports=Object.freeze({WINDOW_CONTRACT,FEATURE_DEFINITIONS,extractFeatures});
