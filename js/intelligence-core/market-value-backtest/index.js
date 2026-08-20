'use strict';

const Analysis=require('../breakout-backtest/analysis');
const Features=require('../breakout-backtest/features');

const SPLITS=Object.freeze([{evidenceSeason:2023,outcomeSeason:2024},{evidenceSeason:2024,outcomeSeason:2025}]);
const SIGNALS=Object.freeze({
  RB:Object.freeze([['targetsPerGame',1],['receivingYardsPerGame',1],['touchesPerGame',1],['rushingAttemptsPerGame',1],['yardsPerCarry',1],['targetGrowth',1],['rushingAttemptGrowth',1],['lateRushingAttempts',1],['lateTargets',1]]),
  WR:Object.freeze([['targetsPerGame',1],['receivingYardsPerGame',1],['lateTargets',1],['targetGrowth',1],['yardsPerTarget',1],['receptionsPerTarget',1]]),
  TE:Object.freeze([['targetsPerGame',1],['lateTargets',1],['targetGrowth',1],['receivingYardsPerGame',1]]),
  QB:Object.freeze([['lateRushingAttempts',1],['rushingAttemptGrowth',1],['yardsPerAttempt',1],['interceptionRate',-1],['rushingAttemptsPerGame',1],['rushingYardsPerGame',1]]),
});
const DEVELOPMENT_SIGNALS=Object.freeze([['ageAtSeason',-1],['yearInLeague',-1]]);
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const round=value=>Number.isFinite(value)?Number(value.toFixed(4)):null;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const key=row=>`${row.currentCanonicalPlayerId??row.canonicalPlayerId}|${row.evidenceSeason}`;
const splitKey=row=>`${row.evidenceSeason}_${row.outcomeSeason}`;
const appreciationRate=rows=>round(rows.length?rows.filter(row=>row.isAppreciation).length/rows.length:null);

function bucket(value,bands){
  const numeric=finite(value);if(numeric===null)return 'UNKNOWN';
  return bands.find(item=>numeric>=item.minimum&&numeric<item.maximumExclusive)?.label||'UNKNOWN';
}

const COST_BANDS=Object.freeze([{label:'ADP_1_36',minimum:1,maximumExclusive:37},{label:'ADP_37_72',minimum:37,maximumExclusive:73},{label:'ADP_73_120',minimum:73,maximumExclusive:121},{label:'ADP_121_PLUS',minimum:121,maximumExclusive:Infinity}]);
const ROUND_BANDS=Object.freeze([{label:'ROUNDS_1_3',minimum:1,maximumExclusive:4},{label:'ROUNDS_4_6',minimum:4,maximumExclusive:7},{label:'ROUNDS_7_10',minimum:7,maximumExclusive:11},{label:'ROUNDS_11_PLUS',minimum:11,maximumExclusive:Infinity}]);
const POSITION_COST_BANDS=Object.freeze([{label:'POS_1_12',minimum:1,maximumExclusive:13},{label:'POS_13_24',minimum:13,maximumExclusive:25},{label:'POS_25_PLUS',minimum:25,maximumExclusive:Infinity}]);
const CAREER_STAGES=Object.freeze([{label:'YEAR_1',minimum:1,maximumExclusive:2},{label:'YEAR_2',minimum:2,maximumExclusive:3},{label:'YEAR_3',minimum:3,maximumExclusive:4},{label:'YEAR_4_PLUS',minimum:4,maximumExclusive:Infinity}]);
const AGE_BANDS=Object.freeze([{label:'AGE_22_OR_YOUNGER',minimum:0,maximumExclusive:23},{label:'AGE_23_25',minimum:23,maximumExclusive:26},{label:'AGE_26_28',minimum:26,maximumExclusive:29},{label:'AGE_29_PLUS',minimum:29,maximumExclusive:Infinity}]);

function groupedRates(rows,getter,labels){
  const result={};for(const label of labels){const group=rows.filter(row=>getter(row)===label);result[label]=Object.freeze({n:group.length,appreciations:group.filter(row=>row.isAppreciation).length,rate:appreciationRate(group)});}return Object.freeze(result);
}

function attachDevelopment(transitions,developmentSnapshot){
  const index=new Map((developmentSnapshot?.records||[]).map(row=>[`${row.canonicalPlayerId}|${row.position}|${row.season}`,row]));
  return Object.freeze(transitions.map(transition=>{
    const record=transition.currentCanonicalPlayerId?index.get(`${transition.currentCanonicalPlayerId}|${transition.position}|${transition.evidenceSeason}`):null;
    return Object.freeze({...transition,development:Object.freeze({ageAtSeason:finite(record?.ageAtSeason),yearInLeague:finite(record?.yearInLeague),status:record?'EVIDENCE_PRESENT':'UNKNOWN'})});
  }));
}

function baseRates(transitions,developmentSnapshot){
  const rows=attachDevelopment(transitions,developmentSnapshot),positions={};
  for(const position of Object.keys(SIGNALS)){
    const group=rows.filter(row=>row.position===position);
    positions[position]=Object.freeze({
      overall:Object.freeze({n:group.length,appreciations:group.filter(row=>row.isAppreciation).length,rate:appreciationRate(group)}),
      startingAdp:groupedRates(group,row=>bucket(row.evidence.overallAdp,COST_BANDS),COST_BANDS.map(item=>item.label)),
      startingRound:groupedRates(group,row=>bucket(row.evidence.adpRound,ROUND_BANDS),ROUND_BANDS.map(item=>item.label)),
      positionAdp:groupedRates(group,row=>bucket(row.evidence.positionAdpRank,POSITION_COST_BANDS),POSITION_COST_BANDS.map(item=>item.label)),
      ageBand:groupedRates(group,row=>bucket(row.development.ageAtSeason,AGE_BANDS),[...AGE_BANDS.map(item=>item.label),'UNKNOWN']),
      yearInLeague:groupedRates(group,row=>bucket(row.development.yearInLeague,CAREER_STAGES),[...CAREER_STAGES.map(item=>item.label),'UNKNOWN']),
    });
  }
  return Object.freeze({overall:Object.freeze({n:rows.length,appreciations:rows.filter(row=>row.isAppreciation).length,rate:appreciationRate(rows)}),positions:Object.freeze(positions)});
}

function marketExamples({transitions,usageSnapshot,players=[]}){
  const usageIndex=new Map((usageSnapshot?.players||[]).map(row=>[`${row.canonicalPlayerId}|${row.position}|${row.season}`,row])),playerIndex=new Map(players.map(player=>[String(player.id),player])),examples=[];
  for(const transition of transitions){
    if(!transition.currentCanonicalPlayerId||!SPLITS.some(split=>split.evidenceSeason===transition.evidenceSeason&&split.outcomeSeason===transition.outcomeSeason))continue;
    const usage=usageIndex.get(`${transition.currentCanonicalPlayerId}|${transition.position}|${transition.evidenceSeason}`);if(!usage||finite(usage.sample?.weeksObserved)<8)continue;
    if(usage.season!==transition.evidenceSeason||transition.outcomeSeason!==transition.evidenceSeason+1)throw new TypeError('market predictors may only use Season N evidence');
    examples.push(Object.freeze({canonicalPlayerId:transition.currentCanonicalPlayerId,playerName:playerIndex.get(String(transition.currentCanonicalPlayerId))?.name||transition.displayName,position:transition.position,evidenceSeason:transition.evidenceSeason,outcomeSeason:transition.outcomeSeason,features:Features.extractFeatures(usage,{evidenceSeason:transition.evidenceSeason}),outcome:Object.freeze({isBreakout:transition.isAppreciation,outcomePercentile:transition.marketPercentileGain,label:transition.appreciationClass,adpGain:transition.adpGain,roundGain:transition.roundGain,evidenceAdp:transition.evidence.overallAdp,outcomeAdp:transition.outcome.overallAdp})}));
  }
  return Object.freeze(examples.sort((a,b)=>a.evidenceSeason-b.evidenceSeason||a.position.localeCompare(b.position)||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)));
}

function readiness(classification){return classification==='CONSISTENT'?'READY_FOR_SHADOW_MODEL':classification==='PROMISING_BUT_UNSTABLE'?'PROMISING_NEEDS_MORE_DATA':classification;}

function analyzeUsageSignals(examples){
  const result={};
  for(const [position,definitions] of Object.entries(SIGNALS)){
    const rows=examples.filter(row=>row.position===position),signals=[];
    for(const [feature,direction] of definitions){
      const splits=SPLITS.map(split=>Object.freeze({...split,...Analysis.analyzeSplit(rows.filter(row=>row.evidenceSeason===split.evidenceSeason),feature,direction)}));
      const classification=Analysis.classifyConsistency(splits);
      signals.push(Object.freeze({feature,direction,classification,readiness:readiness(classification),meanAuc:round(mean(splits.map(item=>item.auc).filter(item=>item!==null))),splits:Object.freeze(splits)}));
    }
    signals.sort((a,b)=>(b.meanAuc??-1)-(a.meanAuc??-1)||a.feature.localeCompare(b.feature));
    result[position]=Object.freeze({sampleSizes:Object.freeze(Object.fromEntries(SPLITS.map(split=>[splitKey(split),rows.filter(row=>row.evidenceSeason===split.evidenceSeason).length]))),signals:Object.freeze(signals)});
  }
  return Object.freeze(result);
}

function developmentExamples(examples,developmentSnapshot){
  const index=new Map((developmentSnapshot?.records||[]).map(row=>[`${row.canonicalPlayerId}|${row.position}|${row.season}`,row]));
  return Object.freeze(examples.map(example=>{const record=index.get(`${example.canonicalPlayerId}|${example.position}|${example.evidenceSeason}`);return Object.freeze({...example,development:Object.freeze({ageAtSeason:finite(record?.ageAtSeason),yearInLeague:finite(record?.yearInLeague),status:record?'EVIDENCE_PRESENT':'UNKNOWN'})});}));
}

function analyzeDevelopment(examples,developmentSnapshot){
  const attached=developmentExamples(examples,developmentSnapshot),result={};
  for(const position of Object.keys(SIGNALS)){
    result[position]=Object.freeze(Object.fromEntries(DEVELOPMENT_SIGNALS.map(([feature,direction])=>{
      const splits=SPLITS.map(split=>{const shaped=attached.filter(row=>row.position===position&&row.evidenceSeason===split.evidenceSeason&&finite(row.development[feature])!==null).map(row=>Object.freeze({...row,features:Object.freeze({values:Object.freeze({[feature]:row.development[feature]})})}));return Object.freeze({...split,...Analysis.analyzeSplit(shaped,feature,direction)});});
      const classification=Analysis.classifyConsistency(splits);return[feature,Object.freeze({direction,classification,readiness:readiness(classification),meanAuc:round(mean(splits.map(item=>item.auc).filter(item=>item!==null))),splits:Object.freeze(splits)})];
    })));
  }
  return Object.freeze(result);
}

function productionComparison(market,production){
  const result={};
  for(const [position,report] of Object.entries(market))result[position]=Object.freeze(report.signals.map(signal=>{
    const prior=production?.positions?.[position]?.signals?.find(item=>item.feature===signal.feature)||null;
    const productionStrength=prior?.readiness||prior?.classification||'NOT_TESTED';
    return Object.freeze({signal:signal.feature,productionBreakoutStrength:productionStrength,productionMeanAuc:prior?.meanAuc??null,marketAppreciationStrength:signal.readiness,marketMeanAuc:signal.meanAuc,crossYearStability:signal.classification,interpretation:signal.meanAuc!==null&&prior?.meanAuc!==null?(signal.meanAuc>prior.meanAuc?'STRONGER_FOR_MARKET_APPRECIATION':signal.meanAuc<prior.meanAuc?'STRONGER_FOR_PRODUCTION_BREAKOUT':'SIMILAR_DISCRIMINATION'):'INSUFFICIENT_COMPARISON'});
  }));
  return Object.freeze(result);
}

function topThirdIds(rows,signal){
  const usable=rows.filter(row=>finite(row.features.values[signal.feature])!==null),count=Math.floor(usable.length/3);if(!count)return new Set();
  const ordered=[...usable].sort((a,b)=>(b.features.values[signal.feature]-a.features.values[signal.feature])*signal.direction),cutoff=ordered[count-1].features.values[signal.feature]*signal.direction;
  return new Set(ordered.filter(row=>row.features.values[signal.feature]*signal.direction>=cutoff).map(key));
}

function caseStudies(examples,marketSignals,productionExamples=[]){
  const flags=new Map();
  for(const split of SPLITS)for(const [position,report] of Object.entries(marketSignals)){
    const rows=examples.filter(row=>row.position===position&&row.evidenceSeason===split.evidenceSeason),usableSignals=report.signals.filter(signal=>signal.classification!=='INSUFFICIENT_SAMPLE');
    for(const signal of usableSignals)for(const id of topThirdIds(rows,signal)){if(!flags.has(id))flags.set(id,[]);flags.get(id).push(signal.feature);}
  }
  const compact=row=>Object.freeze({canonicalPlayerId:row.canonicalPlayerId,playerName:row.playerName,position:row.position,evidenceSeason:row.evidenceSeason,outcomeSeason:row.outcomeSeason,evidenceAdp:row.outcome.evidenceAdp,outcomeAdp:row.outcome.outcomeAdp,adpGain:round(row.outcome.adpGain),appreciationClass:row.outcome.label,flaggedSignals:Object.freeze(flags.get(key(row))||[])});
  const strong=row=>['ELITE_APPRECIATION','MAJOR_APPRECIATION'].includes(row.outcome.label),sortGain=(a,b)=>b.outcome.adpGain-a.outcome.adpGain||a.playerName.localeCompare(b.playerName);
  const truePositives=examples.filter(row=>strong(row)&&(flags.get(key(row))||[]).length).sort(sortGain).slice(0,12).map(compact);
  const falseNegatives=examples.filter(row=>strong(row)&&!(flags.get(key(row))||[]).length).sort(sortGain).slice(0,12).map(compact);
  const falsePositives=examples.filter(row=>!row.outcome.isBreakout&&(flags.get(key(row))||[]).length>=2).sort((a,b)=>(flags.get(key(b))||[]).length-(flags.get(key(a))||[]).length||a.playerName.localeCompare(b.playerName)).slice(0,12).map(compact);
  const productionIndex=new Map(productionExamples.map(row=>[`${row.canonicalPlayerId}|${row.evidenceSeason}`,row]));
  const valueTraps=examples.filter(row=>row.outcome.isBreakout&&productionIndex.has(key(row))&&!productionIndex.get(key(row)).outcome.isBreakout).sort(sortGain).slice(0,12).map(row=>Object.freeze({...compact(row),productionOutcome:productionIndex.get(key(row)).outcome.label}));
  return Object.freeze({truePositives:Object.freeze(truePositives),falsePositives:Object.freeze(falsePositives),falseNegatives:Object.freeze(falseNegatives),valueTraps:Object.freeze(valueTraps)});
}

function survivorship(transitions){
  const current=transitions.filter(row=>row.identityScope==='PRODUCTION_CANONICAL'),historical=transitions.filter(row=>row.identityScope==='RESEARCH_HISTORICAL');
  const rates=rows=>Object.freeze({transitions:rows.length,appreciations:rows.filter(row=>row.isAppreciation).length,rate:appreciationRate(rows)});
  return Object.freeze({fullHistoricalUniverse:rates(transitions),current2026PoolOnly:rates(current),historicalOnly:rates(historical),transitionsGained:historical.length,conclusion:historical.length?'Historical-only identities materially expand sample coverage; inference should not be restricted to survivors in the 2026 pool.':'NO_HISTORICAL_EXPANSION'});
}

function runMarketBacktest({normalizedAdp,usageSnapshot,developmentSnapshot,players=[],productionBaseline}={}){
  const transitions=require('../historical-adp').buildTransitions(normalizedAdp),examples=marketExamples({transitions,usageSnapshot,players}),usageSignals=analyzeUsageSignals(examples),development=analyzeDevelopment(examples,developmentSnapshot),productionExamples=Analysis.buildExamples(usageSnapshot.players,players);
  const ready=Object.values(usageSignals).flatMap(row=>row.signals).filter(row=>row.readiness==='READY_FOR_SHADOW_MODEL');
  const finalDecision=ready.length>=2?'READY FOR SHADOW COMPOSITE':'MORE DATA REQUIRED';
  return Object.freeze({schemaVersion:1,milestone:'Jōnin 4.3.16',mode:'OFFLINE_RESEARCH_SHADOW_ONLY',recommendationAuthority:false,methodology:Object.freeze({outcome:'Season N preseason ADP minus Season N+1 preseason ADP',meaningfulThreshold:24,thresholdRationale:'Two 12-team rounds is a predetermined economically visible change; four and six rounds define major and elite appreciation.',predictors:'Frozen Season N usage and development features only.',splits:SPLITS}),coverage:Object.freeze({allTransitions:transitions.length,usageExamples:examples.length}),baseRates:baseRates(transitions,developmentSnapshot),usageSignals,developmentSignals:development,productionVsMarket:productionComparison(usageSignals,productionBaseline),caseStudies:caseStudies(examples,usageSignals,productionExamples),survivorship:survivorship(transitions),temporalSafety:Object.freeze({evidenceSeasonOnly:true,outcomeIsNextPreseasonAdp:true,nextSeasonUsageConsumed:false,nextSeasonProductionConsumedAsPredictor:false}),composite:Object.freeze({created:false,readySignals:ready.map(row=>row.feature),decision:finalDecision}),currentWatchlist:Object.freeze({created:false,reason:'Current-player scoring is outside Jōnin 4.3.16.'}),browserBundleIncreaseBytes:0,finalDecision});
}

module.exports=Object.freeze({SPLITS,SIGNALS,DEVELOPMENT_SIGNALS,COST_BANDS,ROUND_BANDS,POSITION_COST_BANDS,AGE_BANDS,CAREER_STAGES,bucket,attachDevelopment,baseRates,marketExamples,analyzeUsageSignals,analyzeDevelopment,productionComparison,caseStudies,survivorship,runMarketBacktest});
