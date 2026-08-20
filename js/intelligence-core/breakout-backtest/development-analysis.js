'use strict';

const Analysis=require('./analysis');
const Features=require('./features');

const SPLITS=Analysis.SPLITS;
const DEVELOPMENT_FEATURES=Object.freeze([
  Object.freeze({feature:'ageAtSeason',direction:-1,effectDirection:'YOUNGER_HIGHER'}),
  Object.freeze({feature:'yearInLeague',direction:-1,effectDirection:'EARLIER_CAREER_HIGHER'}),
]);
const INTERACTION_FEATURES=Object.freeze({
  RB:Object.freeze(['targetsPerGame','receivingYardsPerGame']),
  WR:Object.freeze(['targetsPerGame','lateTargets','targetGrowth','receivingYardsPerGame']),
  TE:Object.freeze(['lateTargets']),
  QB:Object.freeze(['lateRushingAttempts','interceptionRate','rushingAttemptGrowth']),
});
const PRIMARY_CASE_SIGNALS=Object.freeze({RB:'targetsPerGame',WR:'targetsPerGame',TE:'lateTargets',QB:'lateRushingAttempts'});
const INTERACTION_FORMULA=Object.freeze({
  id:'USAGE_75_DEVELOPMENT_25',
  expression:'0.75 * within-transition aligned usage rank percentile + 0.25 * within-transition aligned development rank percentile',
  usageWeight:0.75,
  developmentWeight:0.25,
  note:'Weights were fixed before evaluating either historical transition and were not optimized.',
});
const FALSE_POSITIVE_NAMES=Object.freeze(['Alvin Kamara','Patrick Mahomes','Russell Wilson','Evan Engram']);
const FALSE_NEGATIVE_NAMES=Object.freeze(['Joe Burrow','Drake Maye','Trevor Lawrence','Chase Brown','Rico Dowdle','Chuba Hubbard','Christian Watson','Jauan Jennings','Parker Washington','Kyle Pitts','Tucker Kraft','Mike Gesicki']);

const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const round=value=>Number.isFinite(value)?Number(value.toFixed(4)):null;
const mean=values=>values.length?values.reduce((total,value)=>total+value,0)/values.length:null;
const rate=rows=>rows.length?rows.filter(row=>row.outcome.isBreakout).length/rows.length:null;
const splitKey=split=>`${split.evidenceSeason}_${split.outcomeSeason}`;
const stage=value=>value===1?'YEAR_1':value===2?'YEAR_2':value===3?'YEAR_3':Number.isFinite(value)&&value>=4?'YEAR_4_PLUS':'UNKNOWN';
const sampleLabel=n=>n<15?'SMALL_SAMPLE':'ADEQUATE_SAMPLE';

function attachDevelopment(examples=[],developmentSnapshot){
  if(!developmentSnapshot?.records)throw new TypeError('historical development snapshot is required');
  const index=new Map(developmentSnapshot.records.map(record=>[`${record.canonicalPlayerId}|${record.position}|${record.season}`,record]));
  return Object.freeze(examples.map(example=>{
    if(!(example.evidenceSeason<example.outcomeSeason))throw new TypeError('development evidence must precede outcome season');
    const record=index.get(`${example.canonicalPlayerId}|${example.position}|${example.evidenceSeason}`)||null;
    if(record&&record.season!==example.evidenceSeason)throw new TypeError('development season must match evidence season');
    return Object.freeze({...example,development:Object.freeze({
      sourceSeason:record?.season??null,
      ageAtSeason:finite(record?.ageAtSeason),
      yearInLeague:finite(record?.yearInLeague),
      careerStage:stage(finite(record?.yearInLeague)),
      status:record?'EVIDENCE_PRESENT':'DEVELOPMENT_UNKNOWN',
    })});
  }));
}

function featureRows(rows,feature){
  return rows.filter(row=>finite(row.development[feature])!==null).map(row=>Object.freeze({...row,features:Object.freeze({values:Object.freeze({[feature]:finite(row.development[feature])})})}));
}

function developmentOnly(examples){
  const result={};
  for(const position of Object.keys(INTERACTION_FEATURES)){
    const rows=examples.filter(row=>row.position===position),features={};
    for(const definition of DEVELOPMENT_FEATURES){
      const splits=SPLITS.map(split=>{
        const measured=Analysis.analyzeSplit(featureRows(rows.filter(row=>row.evidenceSeason===split.evidenceSeason),definition.feature),definition.feature,definition.direction);
        return Object.freeze({evidenceSeason:split.evidenceSeason,outcomeSeason:split.outcomeSeason,...measured,breakoutRate:round(measured.sampleSize?measured.positives/measured.sampleSize:null),nonBreakoutRate:round(measured.sampleSize?measured.negatives/measured.sampleSize:null)});
      });
      features[definition.feature]=Object.freeze({
        effectDirection:definition.effectDirection,
        classification:Analysis.classifyConsistency(splits),
        meanAuc:round(mean(splits.map(item=>item.auc).filter(value=>value!==null))),
        splits:Object.freeze(splits),
      });
    }
    result[position]=Object.freeze(features);
  }
  return Object.freeze(result);
}

function quantile(values,fraction){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)*fraction)];
}

function compactRate(rows){
  const breakouts=rows.filter(row=>row.outcome.isBreakout).length;
  return Object.freeze({n:rows.length,breakouts,nonBreakouts:rows.length-breakouts,breakoutRate:round(rows.length?breakouts/rows.length:null),sampleLabel:sampleLabel(rows.length)});
}

function conditionalRates(examples){
  const result={};
  for(const position of Object.keys(INTERACTION_FEATURES)){
    const positionRows=examples.filter(row=>row.position===position),stageRates={},ageBands={};
    for(const name of ['YEAR_1','YEAR_2','YEAR_3','YEAR_4_PLUS','UNKNOWN']){
      const rows=positionRows.filter(row=>row.development.careerStage===name);
      stageRates[name]=Object.freeze({overall:compactRate(rows),splits:Object.freeze(Object.fromEntries(SPLITS.map(split=>[splitKey(split),compactRate(rows.filter(row=>row.evidenceSeason===split.evidenceSeason))]))) });
    }
    for(const split of SPLITS){
      const rows=positionRows.filter(row=>row.evidenceSeason===split.evidenceSeason&&finite(row.development.ageAtSeason)!==null),values=rows.map(row=>row.development.ageAtSeason),youngerMax=quantile(values,1/3),olderMin=quantile(values,2/3);
      const bands={
        YOUNGER:rows.filter(row=>row.development.ageAtSeason<=youngerMax),
        MIDDLE:rows.filter(row=>row.development.ageAtSeason>youngerMax&&row.development.ageAtSeason<olderMin),
        OLDER:rows.filter(row=>row.development.ageAtSeason>=olderMin),
      };
      ageBands[splitKey(split)]=Object.freeze({method:'WITHIN_POSITION_TRANSITION_TERTILES',youngerMax,olderMin,bands:Object.freeze(Object.fromEntries(Object.entries(bands).map(([key,value])=>[key,compactRate(value)])))});
    }
    result[position]=Object.freeze({careerStage:Object.freeze(stageRates),ageBands:Object.freeze(ageBands)});
  }
  return Object.freeze(result);
}

function alignedPercentiles(rows,getter,direction){
  const values=rows.map(row=>getter(row)*direction),ranked=Analysis.ranks(values),denominator=Math.max(rows.length-1,1);
  return new Map(rows.map((row,index)=>[row,(ranked[index]-1)/denominator]));
}

function evaluateInteractionRows(rows,usageFeature,developmentFeature){
  const usageDirection=Features.FEATURE_DEFINITIONS[rows[0]?.position]?.find(([name])=>name===usageFeature)?.[1];
  if(!usageDirection)return Object.freeze([]);
  const usable=rows.filter(row=>finite(row.features.values[usageFeature])!==null&&finite(row.development[developmentFeature])!==null);
  const usageRanks=alignedPercentiles(usable,row=>row.features.values[usageFeature],usageDirection),developmentRanks=alignedPercentiles(usable,row=>row.development[developmentFeature],-1);
  return Object.freeze(usable.map(row=>Object.freeze({...row,interaction:Object.freeze({
    usageRank:usageRanks.get(row),developmentRank:developmentRanks.get(row),
    combined:INTERACTION_FORMULA.usageWeight*usageRanks.get(row)+INTERACTION_FORMULA.developmentWeight*developmentRanks.get(row),
  })})));
}

function scoreMetrics(rows,key){
  const shaped=rows.map(row=>Object.freeze({...row,features:Object.freeze({values:Object.freeze({score:key==='usage'?row.interaction.usageRank:row.interaction.combined})})}));
  return Analysis.analyzeSplit(shaped,'score',1);
}

function classifyInteraction(splits){
  if(splits.some(item=>item.combined.sampleSize<15||item.combined.positives<3||item.combined.negatives<3||item.combined.auc===null))return 'INSUFFICIENT_SAMPLE';
  const deltas=splits.map(item=>item.aucDelta),combined=splits.map(item=>item.combined.auc),meanDelta=mean(deltas);
  if((deltas[0]>=0.02&&deltas[1]<=-0.02)||(deltas[1]>=0.02&&deltas[0]<=-0.02)||(combined[0]>=0.58&&combined[1]<=0.48)||(combined[1]>=0.58&&combined[0]<=0.48))return 'CONTRADICTORY';
  if(splits.every(item=>item.combined.auc>=0.58&&item.aucDelta>=0.02&&item.combined.rankCorrelation>=0.05&&item.combined.bucketEffect>=0.10))return 'READY_FOR_SHADOW_MODEL';
  if(deltas.every(value=>value>=0)&&meanDelta>=0.01&&mean(combined)>=0.55)return 'PROMISING_NEEDS_MORE_DATA';
  return 'WEAK';
}

function frozenAuc(usageBaseline,position,feature,split){
  return usageBaseline?.positions?.[position]?.signals?.find(item=>item.feature===feature)?.splits?.find(item=>item.evidenceSeason===split.evidenceSeason)?.auc??null;
}

function frozenUsageSignals(usageBaseline){
  const requested={RB:['targetsPerGame','receivingYardsPerGame'],WR:['targetsPerGame','lateTargets','targetGrowth','receivingYardsPerGame'],TE:['lateTargets'],QB:['lateRushingAttempts','interceptionRate','rushingAttemptGrowth']},result={};
  for(const [position,features] of Object.entries(requested))result[position]=Object.freeze(Object.fromEntries(features.map(feature=>[feature,Object.freeze((usageBaseline?.positions?.[position]?.signals?.find(item=>item.feature===feature)?.splits||[]).map(split=>Object.freeze({evidenceSeason:split.evidenceSeason,outcomeSeason:split.outcomeSeason,auc:split.auc})))])));
  return Object.freeze(result);
}

function interactions(examples,usageBaseline){
  const result={};
  for(const [position,usageFeatures] of Object.entries(INTERACTION_FEATURES)){
    const positionRows=examples.filter(row=>row.position===position),rows=[];
    for(const usageFeature of usageFeatures){
      for(const developmentFeature of DEVELOPMENT_FEATURES.map(item=>item.feature)){
        const splits=SPLITS.map(split=>{
          const evaluated=evaluateInteractionRows(positionRows.filter(row=>row.evidenceSeason===split.evidenceSeason),usageFeature,developmentFeature),usage=scoreMetrics(evaluated,'usage'),combined=scoreMetrics(evaluated,'combined');
          return Object.freeze({evidenceSeason:split.evidenceSeason,outcomeSeason:split.outcomeSeason,frozenUsageBaselineAuc:frozenAuc(usageBaseline,position,usageFeature,split),comparableUsage:usage,combined,aucDelta:round(combined.auc!==null&&usage.auc!==null?combined.auc-usage.auc:null)});
        });
        const readiness=classifyInteraction(splits);
        rows.push(Object.freeze({usageFeature,developmentFeature,formula:INTERACTION_FORMULA.id,readiness,meanComparableUsageAuc:round(mean(splits.map(item=>item.comparableUsage.auc).filter(value=>value!==null))),meanCombinedAuc:round(mean(splits.map(item=>item.combined.auc).filter(value=>value!==null))),meanAucDelta:round(mean(splits.map(item=>item.aucDelta).filter(value=>value!==null))),splits:Object.freeze(splits)}));
      }
    }
    result[position]=Object.freeze(rows);
  }
  return Object.freeze(result);
}

function positionConclusions(interactionReport){
  const result={};
  for(const [position,rows] of Object.entries(interactionReport)){
    const readiness=rows.map(row=>row.readiness);
    const classification=readiness.includes('READY_FOR_SHADOW_MODEL')?'SUPPORTED':readiness.includes('PROMISING_NEEDS_MORE_DATA')?'PROMISING_BUT_UNSTABLE':readiness.every(value=>value==='INSUFFICIENT_SAMPLE')?'INSUFFICIENT_SAMPLE':readiness.includes('CONTRADICTORY')?'CONTRADICTORY':'WEAK';
    result[position]=Object.freeze({classification,readySignals:rows.filter(row=>row.readiness==='READY_FOR_SHADOW_MODEL').map(row=>`${row.usageFeature} × ${row.developmentFeature}`),promisingSignals:rows.filter(row=>row.readiness==='PROMISING_NEEDS_MORE_DATA').map(row=>`${row.usageFeature} × ${row.developmentFeature}`)});
  }
  return Object.freeze(result);
}

function topThird(rows,key){
  if(!rows.length)return new Set();
  const ordered=[...rows].sort((a,b)=>b.interaction[key]-a.interaction[key]),count=Math.max(1,Math.floor(rows.length/3)),cutoff=ordered[count-1].interaction[key];
  return new Set(ordered.filter(row=>row.interaction[key]>=cutoff).map(row=>`${row.canonicalPlayerId}|${row.evidenceSeason}`));
}

function auditCases(examples,names,type){
  return Object.freeze(names.map(playerName=>{
    const occurrences=[],playerRows=examples.filter(row=>row.playerName===playerName&&(type==='FALSE_POSITIVE'?!row.outcome.isBreakout:row.outcome.isBreakout));
    for(const row of playerRows){
      const usageFeature=PRIMARY_CASE_SIGNALS[row.position];
      for(const developmentFeature of DEVELOPMENT_FEATURES.map(item=>item.feature)){
        const splitRows=examples.filter(item=>item.position===row.position&&item.evidenceSeason===row.evidenceSeason),evaluated=evaluateInteractionRows(splitRows,usageFeature,developmentFeature),key=`${row.canonicalPlayerId}|${row.evidenceSeason}`,usageFlag=topThird(evaluated,'usageRank').has(key),combinedFlag=topThird(evaluated,'combined').has(key);
        if(!evaluated.some(item=>`${item.canonicalPlayerId}|${item.evidenceSeason}`===key)){occurrences.push(Object.freeze({evidenceSeason:row.evidenceSeason,developmentFeature,status:'UNKNOWN'}));continue}
        const status=type==='FALSE_POSITIVE'?(usageFlag&&!combinedFlag?'HELPED':!usageFlag&&combinedFlag?'HURT':'NO_EFFECT'):(!usageFlag&&combinedFlag?'IMPROVED_DETECTION':usageFlag&&!combinedFlag?'MADE_DETECTION_WORSE':'NO_EFFECT');
        occurrences.push(Object.freeze({evidenceSeason:row.evidenceSeason,outcomeSeason:row.outcomeSeason,usageFeature,developmentFeature,usageFlag,combinedFlag,status}));
      }
    }
    let conclusion='UNKNOWN';
    const statuses=occurrences.map(item=>item.status);
    if(statuses.length){
      if(type==='FALSE_POSITIVE')conclusion=statuses.includes('HURT')?'HURT':statuses.includes('HELPED')?'HELPED':'NO_EFFECT';
      else conclusion=statuses.includes('MADE_DETECTION_WORSE')?'MADE_DETECTION_WORSE':statuses.includes('IMPROVED_DETECTION')?'IMPROVED_DETECTION':'NO_EFFECT';
    }
    return Object.freeze({playerName,type,conclusion,occurrences:Object.freeze(occurrences)});
  }));
}

function runDevelopmentBacktest({historicalSnapshot,developmentSnapshot,players=[],usageBaseline}={}){
  if(!historicalSnapshot?.players||!developmentSnapshot?.records)throw new TypeError('historical usage and development snapshots are required');
  const usageExamples=Analysis.buildExamples(historicalSnapshot.players,players),examples=attachDevelopment(usageExamples,developmentSnapshot),interactionReport=interactions(examples,usageBaseline),conclusions=positionConclusions(interactionReport),allReadiness=Object.values(interactionReport).flat().map(row=>row.readiness);
  const finalDecision=allReadiness.includes('READY_FOR_SHADOW_MODEL')?'DEVELOPMENT SIGNALS READY FOR SHADOW CHAMPIONSHIP EQUITY MODEL':allReadiness.includes('PROMISING_NEEDS_MORE_DATA')?'PROMISING DEVELOPMENT SIGNALS — MORE VALIDATION NEEDED':allReadiness.every(value=>value==='INSUFFICIENT_SAMPLE')?'INSUFFICIENT DEVELOPMENT DATA':'DEVELOPMENT CONTEXT DOES NOT MATERIALLY IMPROVE CURRENT MODEL';
  return Object.freeze({
    schemaVersion:'1.0',milestone:'Jōnin 4.3.15',mode:'OFFLINE_RESEARCH_SHADOW_ONLY',recommendationAuthority:false,
    historicalSnapshotDate:historicalSnapshot.snapshotDate,developmentSnapshotDate:developmentSnapshot.snapshotDate,
    methodology:Object.freeze({outcome:'Frozen Jōnin 4.3.13 production-percentile ascent outcome',splits:SPLITS,developmentFeatures:DEVELOPMENT_FEATURES,ageBands:'Within-position, within-transition tertiles; no outcome-based threshold search.',interactionFormula:INTERACTION_FORMULA,readiness:'Requires adequate samples, same-transition improvement, cross-transition agreement, plausible direction, and improvement over the comparable usage-only signal.'}),
    sampleSizes:Object.freeze(Object.fromEntries(Object.keys(INTERACTION_FEATURES).map(position=>[position,Object.freeze(Object.fromEntries(SPLITS.map(split=>[splitKey(split),examples.filter(row=>row.position===position&&row.evidenceSeason===split.evidenceSeason).length])))]))),
    developmentOnly:developmentOnly(examples),conditionalBreakoutRates:conditionalRates(examples),interactions:interactionReport,positionConclusions:conclusions,
    caseAudits:Object.freeze({falsePositives:auditCases(examples,FALSE_POSITIVE_NAMES,'FALSE_POSITIVE'),falseNegatives:auditCases(examples,FALSE_NEGATIVE_NAMES,'FALSE_NEGATIVE')}),
    marketValueAppreciation:Object.freeze({recommendedForFutureResearch:true,implemented:false,reason:'Production-percentile ascent cannot distinguish fantasy production improvement from appreciation relative to acquisition cost; historical ADP or equivalent market data is required.'}),
    currentWatchlist:Object.freeze({created:false,reason:allReadiness.includes('READY_FOR_SHADOW_MODEL')?'No 2026 evidence-season usage exists for applying a validated interaction without fabrication.':'No development-aware interaction earned READY_FOR_SHADOW_MODEL.'}),
    limitations:Object.freeze(['Only two historical transitions are available.','Age and career stage are observational context, not causal variables.','Missing entry years remain unknown.','Historical ADP and market-value appreciation are unavailable.','SOURCE LIMITATION: no routes, route participation, TPRR, YPRR, or first-read share.']),
    routeDataStatus:'SOURCE LIMITATION',temporalSafety:Object.freeze({evidenceBeforeOutcome:true,futureUsageConsumed:false,futureTeamConsumed:false,futureRoleConsumed:false,futureDepthChartConsumed:false}),
    frozenBaseline:Object.freeze({milestone:usageBaseline?.milestone??'Jōnin 4.3.13',recommendationAuthority:usageBaseline?.recommendationAuthority??false,artifactMutated:false,signals:frozenUsageSignals(usageBaseline)}),
    finalDecision,
  });
}

module.exports=Object.freeze({DEVELOPMENT_FEATURES,INTERACTION_FEATURES,PRIMARY_CASE_SIGNALS,INTERACTION_FORMULA,FALSE_POSITIVE_NAMES,FALSE_NEGATIVE_NAMES,stage,attachDevelopment,developmentOnly,conditionalRates,evaluateInteractionRows,classifyInteraction,frozenUsageSignals,interactions,positionConclusions,auditCases,runDevelopmentBacktest});
