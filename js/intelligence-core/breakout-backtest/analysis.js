'use strict';

const Outcomes=require('./outcomes');
const Features=require('./features');
const SPLITS=Object.freeze([{evidenceSeason:2023,outcomeSeason:2024},{evidenceSeason:2024,outcomeSeason:2025}]);
const UNAVAILABLE_SIGNALS=Object.freeze({
  QB:Object.freeze(['scrambles','designedRuns','redZoneRushing']),
  RB:Object.freeze(['routes','tprr','yprr','redZoneRole','goalLineRole','contingentWorkload']),
  WR:Object.freeze(['routes','tprr','yprr','firstReadShare','redZoneUsage']),
  TE:Object.freeze(['routes','tprr','yprr','firstReadShare','redZoneUsage']),
});

const mean=values=>values.length?values.reduce((total,value)=>total+value,0)/values.length:null;
const rate=rows=>rows.length?rows.filter(row=>row.outcome.isBreakout).length/rows.length:null;
const round=value=>Number.isFinite(value)?Number(value.toFixed(4)):null;

function ranks(values){
  const indexed=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value),result=Array(values.length);
  for(let start=0;start<indexed.length;){let end=start+1;while(end<indexed.length&&indexed[end].value===indexed[start].value)end++;const rank=(start+end-1)/2+1;for(let cursor=start;cursor<end;cursor++)result[indexed[cursor].index]=rank;start=end}
  return result;
}

function correlation(left,right){
  if(left.length!==right.length||left.length<3)return null;
  const leftMean=mean(left),rightMean=mean(right);let numerator=0,leftSum=0,rightSum=0;
  for(let index=0;index<left.length;index++){const a=left[index]-leftMean,b=right[index]-rightMean;numerator+=a*b;leftSum+=a*a;rightSum+=b*b}
  const denominator=Math.sqrt(leftSum*rightSum);return denominator?numerator/denominator:null;
}

function spearman(left,right){return correlation(ranks(left),ranks(right))}

function auc(rows,feature,direction=1){
  const positives=rows.filter(row=>row.outcome.isBreakout),negatives=rows.filter(row=>!row.outcome.isBreakout);
  if(!positives.length||!negatives.length)return null;
  let wins=0,total=0;
  for(const positive of positives)for(const negative of negatives){const p=positive.features.values[feature]*direction,n=negative.features.values[feature]*direction;wins+=p>n?1:p===n?0.5:0;total++}
  return wins/total;
}

function analyzeSplit(rows,feature,direction){
  const usable=rows.filter(row=>Number.isFinite(row.features.values[feature])),ordered=[...usable].sort((a,b)=>(a.features.values[feature]-b.features.values[feature])*direction),bucketSize=Math.floor(usable.length/3),bottom=bucketSize?ordered.slice(0,bucketSize):[],top=bucketSize?ordered.slice(-bucketSize):[];
  const positives=usable.filter(row=>row.outcome.isBreakout).length,negatives=usable.length-positives;
  return Object.freeze({
    sampleSize:usable.length,positives,negatives,
    auc:round(auc(usable,feature,direction)),
    rankCorrelation:round(spearman(usable.map(row=>row.features.values[feature]*direction),usable.map(row=>row.outcome.outcomePercentile))),
    bottomBucketRate:round(rate(bottom)),topBucketRate:round(rate(top)),
    bucketEffect:round(rate(top)!==null&&rate(bottom)!==null?rate(top)-rate(bottom):null),
    bottomBucketSize:bottom.length,topBucketSize:top.length,
  });
}

function classifyConsistency(splits){
  if(splits.some(split=>split.sampleSize<15||split.positives<3||split.negatives<3||split.auc===null))return 'INSUFFICIENT_SAMPLE';
  const [first,second]=splits,averageAuc=mean(splits.map(split=>split.auc));
  if((first.auc>=0.58&&second.auc<=0.48)||(second.auc>=0.58&&first.auc<=0.48)||(first.rankCorrelation>=0.15&&second.rankCorrelation<=-0.15)||(second.rankCorrelation>=0.15&&first.rankCorrelation<=-0.15))return 'CONTRADICTORY';
  if(first.auc>=0.58&&second.auc>=0.58&&first.rankCorrelation>=0.05&&second.rankCorrelation>=0.05&&first.bucketEffect>=0.10&&second.bucketEffect>=0.10)return 'CONSISTENT';
  if(averageAuc>=0.55&&first.auc>=0.50&&second.auc>=0.50&&first.rankCorrelation>=-0.10&&second.rankCorrelation>=-0.10&&first.bucketEffect>=0&&second.bucketEffect>=0)return 'PROMISING_BUT_UNSTABLE';
  return 'WEAK';
}

function buildExamples(records=[],players=[]){
  const playerIndex=new Map(players.map(player=>[String(player.id),player])),recordIndex=new Map(records.map(record=>[`${record.canonicalPlayerId}|${record.season}`,record])),distributions=Outcomes.buildSeasonDistributions(records),examples=[];
  for(const split of SPLITS){
    for(const featureRecord of records.filter(record=>record.season===split.evidenceSeason)){
      const outcomeRecord=recordIndex.get(`${featureRecord.canonicalPlayerId}|${split.outcomeSeason}`);
      if(!outcomeRecord)continue;
      const outcome=Outcomes.classifyOutcome({featureRecord,outcomeRecord,distributions});
      if(outcome.status!=='LABELED'||!outcome.eligibleForBreakout)continue;
      const features=Features.extractFeatures(featureRecord,{evidenceSeason:split.evidenceSeason}),player=playerIndex.get(String(featureRecord.canonicalPlayerId));
      examples.push(Object.freeze({canonicalPlayerId:String(featureRecord.canonicalPlayerId),playerName:player?.name||`Player ${featureRecord.canonicalPlayerId}`,position:featureRecord.position,evidenceSeason:split.evidenceSeason,outcomeSeason:split.outcomeSeason,features,outcome}));
    }
  }
  return Object.freeze(examples);
}

function analyzeSignals(examples){
  const positions={};
  for(const position of Object.keys(Features.FEATURE_DEFINITIONS)){
    const rows=examples.filter(example=>example.position===position),signals=[];
    for(const [feature,direction] of Features.FEATURE_DEFINITIONS[position]){
      const splitResults=SPLITS.map(split=>({evidenceSeason:split.evidenceSeason,outcomeSeason:split.outcomeSeason,...analyzeSplit(rows.filter(row=>row.evidenceSeason===split.evidenceSeason),feature,direction)}));
      const classification=classifyConsistency(splitResults),meanAuc=round(mean(splitResults.map(split=>split.auc).filter(value=>value!==null)));
      const readiness=classification==='CONSISTENT'&&!['QB','TE'].includes(position)?'READY_FOR_SHADOW_MODEL':classification==='CONSISTENT'||classification==='PROMISING_BUT_UNSTABLE'?'PROMISING_NEEDS_MORE_DATA':'NOT_USEFUL';
      signals.push(Object.freeze({feature,direction,classification,readiness,meanAuc,splits:Object.freeze(splitResults)}));
    }
    signals.sort((a,b)=>(b.meanAuc??-1)-(a.meanAuc??-1)||a.feature.localeCompare(b.feature));
    positions[position]=Object.freeze({sampleSizes:Object.freeze(Object.fromEntries(SPLITS.map(split=>[`${split.evidenceSeason}_${split.outcomeSeason}`,rows.filter(row=>row.evidenceSeason===split.evidenceSeason).length]))),signals:Object.freeze(signals),unavailableSignals:UNAVAILABLE_SIGNALS[position]});
  }
  return Object.freeze(positions);
}

function exampleAudits(examples,positions,{limit=5}={}){
  const result={};
  for(const [position,report] of Object.entries(positions)){
    const signal=report.signals.find(item=>item.classification==='CONSISTENT')||report.signals.find(item=>item.classification==='PROMISING_BUT_UNSTABLE')||report.signals.find(item=>item.classification!=='INSUFFICIENT_SAMPLE');
    if(!signal){result[position]=Object.freeze({signal:null,hits:Object.freeze([]),falsePositives:Object.freeze([]),falseNegatives:Object.freeze([])});continue}
    const rows=examples.filter(example=>example.position===position&&Number.isFinite(example.features.values[signal.feature])),hits=[],falsePositives=[],falseNegatives=[];
    for(const split of SPLITS){
      const splitRows=rows.filter(row=>row.evidenceSeason===split.evidenceSeason).sort((a,b)=>(a.features.values[signal.feature]-b.features.values[signal.feature])*signal.direction),bucketSize=Math.floor(splitRows.length/3),cutoff=bucketSize?splitRows.at(-bucketSize).features.values[signal.feature]:null;
      for(const row of splitRows){
        const aligned=row.features.values[signal.feature]*signal.direction,alignedCutoff=cutoff*signal.direction,flagged=aligned>=alignedCutoff;
        const compact=Object.freeze({canonicalPlayerId:row.canonicalPlayerId,playerName:row.playerName,evidenceSeason:row.evidenceSeason,outcomeSeason:row.outcomeSeason,signal:signal.feature,signalValue:round(row.features.values[signal.feature]),outcomeLabel:row.outcome.label,outcomePercentile:round(row.outcome.outcomePercentile),percentileGain:round(row.outcome.percentileGain),availableExplanation:row.outcome.outcome.games<12?'LIMITED_OUTCOME_AVAILABILITY':'UNEXPLAINED_WITH_AVAILABLE_DATA'});
        if(flagged&&row.outcome.isBreakout)hits.push(compact);
        if(flagged&&!row.outcome.isBreakout)falsePositives.push(compact);
        if(!flagged&&row.outcome.isBreakout)falseNegatives.push(Object.freeze({...compact,availableExplanation:'SUPPORTED_FEATURE_SET_DID_NOT_CAPTURE_ASCENT'}));
      }
    }
    hits.sort((a,b)=>b.percentileGain-a.percentileGain);
    falsePositives.sort((a,b)=>b.signalValue*signal.direction-a.signalValue*signal.direction);
    falseNegatives.sort((a,b)=>b.percentileGain-a.percentileGain);
    result[position]=Object.freeze({signal:signal.feature,classification:signal.classification,hits:Object.freeze(hits.slice(0,limit)),falsePositives:Object.freeze(falsePositives.slice(0,limit)),falseNegatives:Object.freeze(falseNegatives.slice(0,limit))});
  }
  return Object.freeze(result);
}

function runBacktest({historicalSnapshot,players=[]}={}){
  if(!historicalSnapshot?.players)throw new TypeError('historical snapshot is required');
  const examples=buildExamples(historicalSnapshot.players,players),positions=analyzeSignals(examples),outcomeCounts={};
  for(const position of Object.keys(positions))outcomeCounts[position]=Object.freeze(Object.fromEntries(SPLITS.map(split=>{const rows=examples.filter(row=>row.position===position&&row.evidenceSeason===split.evidenceSeason);return[`${split.evidenceSeason}_${split.outcomeSeason}`,Object.freeze(rows.reduce((counts,row)=>{counts[row.outcome.label]=(counts[row.outcome.label]||0)+1;return counts},{}))]})));
  const maximumPairedSamples={};
  for(const position of Object.keys(positions))maximumPairedSamples[position]=Object.freeze(Object.fromEntries(SPLITS.map(split=>{const evidence=new Set(historicalSnapshot.players.filter(record=>record.position===position&&record.season===split.evidenceSeason).map(record=>String(record.canonicalPlayerId))),outcomes=new Set(historicalSnapshot.players.filter(record=>record.position===position&&record.season===split.outcomeSeason).map(record=>String(record.canonicalPlayerId)));return[`${split.evidenceSeason}_${split.outcomeSeason}`,[...evidence].filter(id=>outcomes.has(id)).length]})));
  return Object.freeze({
    schemaVersion:'1.0',milestone:'Jōnin 4.3.13',mode:'SHADOW_BACKTEST',recommendationAuthority:false,
    historicalSnapshotDate:historicalSnapshot.snapshotDate,scoringBasis:Outcomes.SCORING,
    outcomeContract:Object.freeze({labels:Outcomes.LABELS,thresholds:Outcomes.OUTCOME_THRESHOLDS,minimumEvidenceGames:8,minimumOutcomeGames:8,meaningfulAscentMinimumGain:0.20}),
    featureWindows:Features.WINDOW_CONTRACT,splits:SPLITS,
    maximumPairedSamples:Object.freeze(maximumPairedSamples),sampleSizes:Object.freeze(Object.fromEntries(Object.entries(positions).map(([position,report])=>[position,report.sampleSizes]))),
    outcomeCounts:Object.freeze(outcomeCounts),positions,exampleAudits:exampleAudits(examples,positions),
    composite:Object.freeze({created:false,reason:'Two historical transitions support signal validation, not a stable multi-signal coefficient model.'}),
    currentWatchlist:Object.freeze({created:false,reason:'No composite was justified; current-player scoring was intentionally skipped.'}),
  });
}

module.exports=Object.freeze({SPLITS,UNAVAILABLE_SIGNALS,ranks,correlation,spearman,auc,analyzeSplit,classifyConsistency,buildExamples,analyzeSignals,exampleAudits,runBacktest});
