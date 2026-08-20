'use strict';

const Analysis=require('../breakout-backtest/analysis');
const Features=require('../breakout-backtest/features');
const Outcomes=require('../breakout-backtest/outcomes');
const HistoricalAdp=require('../historical-adp');

const SPLITS=Object.freeze([2019,2020,2021,2022,2023,2024].map(evidenceSeason=>Object.freeze({evidenceSeason,outcomeSeason:evidenceSeason+1})));
const SIGNALS=Object.freeze({
  RB:Object.freeze([['yardsPerCarry',1],['lateRushingAttempts',1],['targetsPerGame',1],['receivingYardsPerGame',1],['touchesPerGame',1],['rushingAttemptGrowth',1],['targetGrowth',1]]),
  WR:Object.freeze([['targetsPerGame',1],['lateTargets',1],['targetGrowth',1],['receivingYardsPerGame',1],['yardsPerTarget',1],['receptionsPerTarget',1]]),
  TE:Object.freeze([['targetsPerGame',1],['lateTargets',1],['targetGrowth',1],['receivingYardsPerGame',1],['yardsPerTarget',1]]),
  QB:Object.freeze([['lateRushingAttempts',1],['rushingAttemptGrowth',1],['rushingYardsPerGame',1],['yardsPerAttempt',1],['interceptionRate',-1],['passingTouchdownRate',1]]),
});
const INTERACTIONS=Object.freeze({
  RB:Object.freeze([['targetsPerGame','ageAtSeason'],['targetsPerGame','yearInLeague'],['receivingYardsPerGame','ageAtSeason'],['receivingYardsPerGame','yearInLeague']]),
  WR:Object.freeze([['targetsPerGame','ageAtSeason'],['lateTargets','ageAtSeason'],['targetGrowth','ageAtSeason'],['receivingYardsPerGame','ageAtSeason']]),
  TE:Object.freeze([['lateTargets','yearInLeague']]),
  QB:Object.freeze([]),
});
const HEADROOM_BANDS=Object.freeze([{label:'PICKS_1_24',minimum:1,maximumExclusive:25},{label:'PICKS_25_60',minimum:25,maximumExclusive:61},{label:'PICKS_61_120',minimum:61,maximumExclusive:121},{label:'PICKS_121_PLUS',minimum:121,maximumExclusive:Infinity}]);
const STABILITY_RULE=Object.freeze({
  ready:Object.freeze({minimumTotal:180,minimumPositives:30,minimumAdequateTransitions:4,minimumUsefulTransitions:4,minimumPooledAuc:.58,maximumAdverseTransitions:0,minimumSurvivorSliceAuc:.52}),
  promising:Object.freeze({minimumTotal:100,minimumPositives:20,minimumAdequateTransitions:3,minimumUsefulTransitions:3,minimumPooledAuc:.55,maximumAdverseTransitions:1}),
  adequateTransition:Object.freeze({minimumN:15,minimumPositives:3,minimumNegatives:3}),usefulAuc:.55,adverseAuc:.45,
  note:'Fixed before expanded results: READY requires sample, positive count, repeated useful direction, no severe adverse transition, pooled discrimination, and no current-only survivorship dependence.',
});
const INTERACTION_FORMULA=Object.freeze({usageWeight:.75,developmentWeight:.25,id:'FROZEN_4_3_15_USAGE_75_DEVELOPMENT_25'});
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const round=value=>Number.isFinite(value)?Number(value.toFixed(4)):null;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const rowKey=row=>`${row.canonicalPlayerId}|${row.evidenceSeason}`;
const splitKey=split=>`${split.evidenceSeason}_${split.outcomeSeason}`;
const headroomBand=adp=>HEADROOM_BANDS.find(band=>Number(adp)>=band.minimum&&Number(adp)<band.maximumExclusive)?.label||'UNKNOWN';

function buildExamples({normalizedAdp,usageSnapshot,players=[]}={}){
  const transitions=HistoricalAdp.buildTransitions(normalizedAdp),usageIndex=new Map((usageSnapshot?.players||[]).map(row=>[`${row.canonicalPlayerId}|${row.position}|${row.season}`,row])),playerIndex=new Map(players.map(player=>[String(player.id),player])),examples=[];
  for(const transition of transitions){
    const usage=usageIndex.get(`${transition.canonicalPlayerId}|${transition.position}|${transition.evidenceSeason}`);
    if(!usage||finite(usage.sample?.weeksObserved)<8)continue;
    if(usage.season!==transition.evidenceSeason||transition.outcomeSeason!==transition.evidenceSeason+1)throw new TypeError('Season N usage must precede Season N+1 market outcome');
    examples.push(Object.freeze({canonicalPlayerId:transition.canonicalPlayerId,playerName:playerIndex.get(String(transition.canonicalPlayerId))?.name||transition.displayName,position:transition.position,identityScope:transition.identityScope,evidenceSeason:transition.evidenceSeason,outcomeSeason:transition.outcomeSeason,features:Features.extractFeatures(usage,{evidenceSeason:transition.evidenceSeason}),market:Object.freeze({isBreakout:transition.isAppreciation,outcomePercentile:transition.marketPercentileGain,label:transition.appreciationClass,evidenceAdp:transition.evidence.overallAdp,outcomeAdp:transition.outcome.overallAdp,adpGain:transition.adpGain,roundGain:transition.roundGain,headroomBand:headroomBand(transition.evidence.overallAdp)})}));
  }
  return Object.freeze(examples.sort((a,b)=>a.evidenceSeason-b.evidenceSeason||a.position.localeCompare(b.position)||a.market.evidenceAdp-b.market.evidenceAdp||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)));
}

function asOutcome(rows,outcomeKey='market'){
  return rows.map(row=>Object.freeze({...row,outcome:row[outcomeKey]}));
}

function metrics(rows,feature,direction){
  const shaped=asOutcome(rows),analysis=Analysis.analyzeSplit(shaped,feature,direction),usable=shaped.filter(row=>finite(row.features.values[feature])!==null),base=usable.length?usable.filter(row=>row.outcome.isBreakout).length/usable.length:null;
  return Object.freeze({...analysis,baseRate:round(base),missingRate:round(rows.length?(rows.length-usable.length)/rows.length:null)});
}

function sliceMetrics(rows,feature,direction,scope){
  const subset=rows.filter(row=>row.identityScope===scope);return Object.freeze({scope,potentialN:subset.length,...metrics(subset,feature,direction)});
}

function classifyStability({splits,pooled,currentSlice,historicalSlice}){
  const adequate=splits.filter(item=>item.sampleSize>=STABILITY_RULE.adequateTransition.minimumN&&item.positives>=STABILITY_RULE.adequateTransition.minimumPositives&&item.negatives>=STABILITY_RULE.adequateTransition.minimumNegatives);
  const useful=adequate.filter(item=>item.auc>=STABILITY_RULE.usefulAuc),adverse=adequate.filter(item=>item.auc<=STABILITY_RULE.adverseAuc);
  const survivorSafe=[currentSlice,historicalSlice].filter(item=>item.sampleSize>=30).every(item=>item.auc!==null&&item.auc>=STABILITY_RULE.ready.minimumSurvivorSliceAuc);
  if(pooled.sampleSize<60||pooled.positives<12||adequate.length<3)return'INSUFFICIENT_SAMPLE';
  if((useful.length>=2&&adverse.length>=2)||splits.some(item=>item.auc>=.62)&&splits.some(item=>item.auc!==null&&item.auc<=.42))return'CONTRADICTORY';
  if(pooled.sampleSize>=STABILITY_RULE.ready.minimumTotal&&pooled.positives>=STABILITY_RULE.ready.minimumPositives&&adequate.length>=STABILITY_RULE.ready.minimumAdequateTransitions&&useful.length>=STABILITY_RULE.ready.minimumUsefulTransitions&&pooled.auc>=STABILITY_RULE.ready.minimumPooledAuc&&adverse.length<=STABILITY_RULE.ready.maximumAdverseTransitions&&survivorSafe)return'READY_FOR_SHADOW_COMPOSITE';
  if(pooled.sampleSize>=STABILITY_RULE.promising.minimumTotal&&pooled.positives>=STABILITY_RULE.promising.minimumPositives&&adequate.length>=STABILITY_RULE.promising.minimumAdequateTransitions&&useful.length>=STABILITY_RULE.promising.minimumUsefulTransitions&&pooled.auc>=STABILITY_RULE.promising.minimumPooledAuc&&adverse.length<=STABILITY_RULE.promising.maximumAdverseTransitions)return'PROMISING_NEEDS_MORE_DATA';
  return'WEAK';
}

function transitionSummary(splits){
  const available=splits.filter(item=>item.auc!==null),adequate=available.filter(item=>item.sampleSize>=STABILITY_RULE.adequateTransition.minimumN&&item.positives>=STABILITY_RULE.adequateTransition.minimumPositives&&item.negatives>=STABILITY_RULE.adequateTransition.minimumNegatives);
  return Object.freeze({meanAuc:round(mean(available.map(item=>item.auc))),availableTransitions:available.length,adequateTransitions:adequate.length,usefulTransitions:adequate.filter(item=>item.auc>=STABILITY_RULE.usefulAuc).length,adverseTransitions:adequate.filter(item=>item.auc<=STABILITY_RULE.adverseAuc).length});
}

function headroom(rows,feature,direction){
  return Object.freeze(Object.fromEntries(HEADROOM_BANDS.map(band=>{const group=rows.filter(row=>row.market.headroomBand===band.label);return[band.label,Object.freeze({potentialN:group.length,...metrics(group,feature,direction)})]})));
}

function analyzeSignals(examples,outcomeKey='market'){
  const result={};
  for(const [position,definitions] of Object.entries(SIGNALS)){
    const positionRows=examples.filter(row=>row.position===position&&row[outcomeKey]),signals=[];
    for(const [feature,direction] of definitions){
      const rows=positionRows.map(row=>Object.freeze({...row,market:row[outcomeKey]}));
      const splits=SPLITS.map(split=>{const group=rows.filter(row=>row.evidenceSeason===split.evidenceSeason);return Object.freeze({...split,potentialN:group.length,...metrics(group,feature,direction)})});
      const pooled=metrics(rows,feature,direction),currentSlice=sliceMetrics(rows,feature,direction,'PRODUCTION_CANONICAL'),historicalSlice=sliceMetrics(rows,feature,direction,'RESEARCH_HISTORICAL'),classification=classifyStability({splits,pooled,currentSlice,historicalSlice});
      signals.push(Object.freeze({feature,direction,classification,pooled,transitionConsistency:transitionSummary(splits),splits:Object.freeze(splits),survivorship:Object.freeze({current:currentSlice,historicalOnly:historicalSlice}),headroom:outcomeKey==='market'?headroom(rows,feature,direction):null}));
    }
    signals.sort((a,b)=>(b.pooled.auc??-1)-(a.pooled.auc??-1)||a.feature.localeCompare(b.feature));
    result[position]=Object.freeze({potentialExamples:positionRows.length,signals:Object.freeze(signals)});
  }
  return Object.freeze(result);
}

function attachDevelopment(examples,developmentSnapshot){
  const index=new Map((developmentSnapshot?.records||[]).map(row=>[`${row.canonicalPlayerId}|${row.position}|${row.season}`,row]));
  return Object.freeze(examples.map(example=>{const row=index.get(`${example.canonicalPlayerId}|${example.position}|${example.evidenceSeason}`);return Object.freeze({...example,development:Object.freeze({ageAtSeason:finite(row?.ageAtSeason),yearInLeague:finite(row?.yearInLeague),status:row?'EVIDENCE_PRESENT':'UNKNOWN'})})}));
}

function developmentSignals(examples,developmentSnapshot){
  const attached=attachDevelopment(examples,developmentSnapshot),result={};
  for(const position of Object.keys(SIGNALS))result[position]=Object.freeze(Object.fromEntries([['ageAtSeason',-1],['yearInLeague',-1]].map(([feature,direction])=>{
    const rows=attached.filter(row=>row.position===position).map(row=>Object.freeze({...row,features:Object.freeze({values:Object.freeze({[feature]:row.development[feature]})})}));
    const splits=SPLITS.map(split=>{const group=rows.filter(row=>row.evidenceSeason===split.evidenceSeason);return Object.freeze({...split,potentialN:group.length,...metrics(group,feature,direction)})}),pooled=metrics(rows,feature,direction),currentSlice=sliceMetrics(rows,feature,direction,'PRODUCTION_CANONICAL'),historicalSlice=sliceMetrics(rows,feature,direction,'RESEARCH_HISTORICAL');
    return[feature,Object.freeze({feature,direction,classification:classifyStability({splits,pooled,currentSlice,historicalSlice}),pooled,transitionConsistency:transitionSummary(splits),splits:Object.freeze(splits),survivorship:Object.freeze({current:currentSlice,historicalOnly:historicalSlice})})];
  })));
  return Object.freeze(result);
}

function alignedPercentiles(rows,getter,direction){const values=rows.map(row=>getter(row)*direction),ranks=Analysis.ranks(values),denominator=Math.max(rows.length-1,1);return new Map(rows.map((row,index)=>[row,(ranks[index]-1)/denominator]));}
function interactionRows(rows,usageFeature,developmentFeature,direction){
  const usable=rows.filter(row=>finite(row.features.values[usageFeature])!==null&&finite(row.development[developmentFeature])!==null),usage=alignedPercentiles(usable,row=>row.features.values[usageFeature],direction),development=alignedPercentiles(usable,row=>row.development[developmentFeature],-1);
  return usable.map(row=>Object.freeze({...row,features:Object.freeze({values:Object.freeze({interaction:INTERACTION_FORMULA.usageWeight*usage.get(row)+INTERACTION_FORMULA.developmentWeight*development.get(row)})})}));
}
function analyzeInteractions(examples,developmentSnapshot){
  const attached=attachDevelopment(examples,developmentSnapshot),result={};
  for(const [position,definitions] of Object.entries(INTERACTIONS))result[position]=Object.freeze(definitions.map(([usageFeature,developmentFeature])=>{
    const direction=SIGNALS[position].find(([name])=>name===usageFeature)?.[1]||1,bySplit=SPLITS.map(split=>interactionRows(attached.filter(row=>row.position===position&&row.evidenceSeason===split.evidenceSeason),usageFeature,developmentFeature,direction)),rows=bySplit.flat(),splits=SPLITS.map((split,index)=>Object.freeze({...split,potentialN:attached.filter(row=>row.position===position&&row.evidenceSeason===split.evidenceSeason).length,...metrics(bySplit[index],'interaction',1)})),pooled=metrics(rows,'interaction',1),currentSlice=sliceMetrics(rows,'interaction',1,'PRODUCTION_CANONICAL'),historicalSlice=sliceMetrics(rows,'interaction',1,'RESEARCH_HISTORICAL');
    return Object.freeze({usageFeature,developmentFeature,formula:INTERACTION_FORMULA.id,classification:classifyStability({splits,pooled,currentSlice,historicalSlice}),pooled,transitionConsistency:transitionSummary(splits),splits:Object.freeze(splits),survivorship:Object.freeze({current:currentSlice,historicalOnly:historicalSlice})});
  }));
  return Object.freeze(result);
}

function addProductionOutcomes(examples,usageSnapshot){
  const records=usageSnapshot?.players||[],index=new Map(records.map(row=>[`${row.canonicalPlayerId}|${row.position}|${row.season}`,row])),distributions=Outcomes.buildSeasonDistributions(records),result=[];
  for(const example of examples){const evidence=index.get(`${example.canonicalPlayerId}|${example.position}|${example.evidenceSeason}`),outcome=index.get(`${example.canonicalPlayerId}|${example.position}|${example.outcomeSeason}`);if(!evidence||!outcome)continue;const classified=Outcomes.classifyOutcome({featureRecord:evidence,outcomeRecord:outcome,distributions});if(classified.status!=='LABELED'||!classified.eligibleForBreakout)continue;result.push(Object.freeze({...example,production:Object.freeze({isBreakout:classified.isBreakout,outcomePercentile:classified.percentileGain,label:classified.label})}));}
  return Object.freeze(result);
}

function compareOutcomes(marketSignals,productionSignals){
  const result={};for(const position of Object.keys(SIGNALS))result[position]=Object.freeze(marketSignals[position].signals.map(market=>{const production=productionSignals[position].signals.find(item=>item.feature===market.feature);const useful=value=>['READY_FOR_SHADOW_COMPOSITE','PROMISING_NEEDS_MORE_DATA'].includes(value);return Object.freeze({signal:market.feature,marketClassification:market.classification,marketAuc:market.pooled.auc,productionClassification:production?.classification||'INSUFFICIENT_SAMPLE',productionAuc:production?.pooled.auc??null,category:useful(market.classification)&&useful(production?.classification)?'BOTH':useful(market.classification)?'MARKET_ONLY':useful(production?.classification)?'PRODUCTION_ONLY':'NEITHER'})}));return Object.freeze(result);
}

function caseReviews(examples,signalReport,productionExamples){
  const names=['Brian Thomas Jr.','Bucky Irving','Nico Collins',"De'Von Achane",'Chuba Hubbard','Chase Brown','Bijan Robinson','Christian McCaffrey','CeeDee Lamb','Derrick Henry','Jahmyr Gibbs','Sam LaPorta','Brock Purdy','Jayden Daniels','Dalton Kincaid','Jordan Love','Brock Bowers'],productionIndex=new Map(productionExamples.map(row=>[rowKey(row),row.production]));
  return Object.freeze(names.map(playerName=>{const occurrences=examples.filter(row=>row.playerName===playerName).map(row=>{const signals=signalReport[row.position].signals.filter(signal=>['READY_FOR_SHADOW_COMPOSITE','PROMISING_NEEDS_MORE_DATA'].includes(signal.classification)),flagged=signals.filter(signal=>{const splitRows=examples.filter(item=>item.position===row.position&&item.evidenceSeason===row.evidenceSeason&&finite(item.features.values[signal.feature])!==null),ordered=[...splitRows].sort((a,b)=>(b.features.values[signal.feature]-a.features.values[signal.feature])*signal.direction),count=Math.floor(ordered.length/3);if(!count)return false;const cutoff=ordered[count-1].features.values[signal.feature]*signal.direction;return row.features.values[signal.feature]*signal.direction>=cutoff}).map(signal=>signal.feature);let supportedCause='NO_SUPPORTED_CAUSE';if(row.market.evidenceAdp<=24&&!row.market.isBreakout)supportedCause='LIMITED_MARKET_HEADROOM';else if(row.market.isBreakout&&flagged.length)supportedCause='PREDECLARED_SIGNAL_HIT';else if(row.market.isBreakout&&!flagged.length)supportedCause='AVAILABLE_SIGNALS_MISSED';else if(!row.market.isBreakout&&flagged.length)supportedCause='SIGNAL_FALSE_POSITIVE';return Object.freeze({evidenceSeason:row.evidenceSeason,outcomeSeason:row.outcomeSeason,evidenceAdp:row.market.evidenceAdp,outcomeAdp:row.market.outcomeAdp,adpGain:row.market.adpGain,marketLabel:row.market.label,headroomBand:row.market.headroomBand,flaggedSignals:Object.freeze(flagged),productionLabel:productionIndex.get(rowKey(row))?.label??'UNAVAILABLE',supportedCause})});return Object.freeze({playerName,occurrences:Object.freeze(occurrences)})}));
}

function run({normalizedAdp,usageSnapshot,developmentSnapshot,players=[]}={}){
  const examples=buildExamples({normalizedAdp,usageSnapshot,players}),marketSignals=analyzeSignals(examples),development=developmentSignals(examples,developmentSnapshot),interactions=analyzeInteractions(examples,developmentSnapshot),productionExamples=addProductionOutcomes(examples,usageSnapshot),productionSignals=analyzeSignals(productionExamples,'production');
  const readyUsage=Object.entries(marketSignals).flatMap(([position,report])=>report.signals.filter(item=>item.classification==='READY_FOR_SHADOW_COMPOSITE').map(item=>`${position}:${item.feature}`)),readyDevelopment=Object.entries(development).flatMap(([position,report])=>Object.values(report).filter(item=>item.classification==='READY_FOR_SHADOW_COMPOSITE').map(item=>`${position}:${item.feature}`)),readyInteractions=Object.entries(interactions).flatMap(([position,rows])=>rows.filter(item=>item.classification==='READY_FOR_SHADOW_COMPOSITE').map(item=>`${position}:${item.usageFeature}×${item.developmentFeature}`));
  const readyPositions=new Set([...readyUsage,...readyInteractions].map(item=>item.split(':')[0])),hasHeadroomRobustSignal=Object.values(marketSignals).flatMap(item=>item.signals).some(signal=>signal.classification==='READY_FOR_SHADOW_COMPOSITE'&&Object.values(signal.headroom).some(band=>band.sampleSize>=30&&band.positives>=5&&band.auc>=.55));
  const go=readyUsage.length>=1&&(readyUsage.length+readyInteractions.length>=2||readyPositions.size>=2)&&hasHeadroomRobustSignal;
  return Object.freeze({schemaVersion:1,milestone:'Jōnin 4.3.17',mode:'OFFLINE_RESEARCH_SHADOW_ONLY',recommendationAuthority:false,methodology:Object.freeze({splits:SPLITS,signals:SIGNALS,interactions:INTERACTIONS,interactionFormula:INTERACTION_FORMULA,stabilityRule:STABILITY_RULE,headroomBands:HEADROOM_BANDS}),coverage:Object.freeze({sourceRows:usageSnapshot.sourceRows??null,usageSeasons:usageSnapshot.seasons,usagePlayerSeasons:usageSnapshot.players?.length??0,marketTransitions:HistoricalAdp.buildTransitions(normalizedAdp).length,pairedUsageExamples:examples.length,productionComparableExamples:productionExamples.length,byTransition:Object.freeze(Object.fromEntries(SPLITS.map(split=>[splitKey(split),examples.filter(row=>row.evidenceSeason===split.evidenceSeason).length])))}),fieldAvailability:usageSnapshot.fieldAvailability||null,marketBaseRates:Object.freeze(Object.fromEntries(Object.keys(SIGNALS).map(position=>{const rows=examples.filter(row=>row.position===position);return[position,Object.freeze({n:rows.length,positives:rows.filter(row=>row.market.isBreakout).length,rate:round(rows.length?rows.filter(row=>row.market.isBreakout).length/rows.length:null)})]}))),marketSignals,developmentSignals:development,interactions,productionVsMarket:compareOutcomes(marketSignals,productionSignals),caseReviews:caseReviews(examples,marketSignals,productionExamples),survivorship:Object.freeze({currentExamples:examples.filter(row=>row.identityScope==='PRODUCTION_CANONICAL').length,historicalOnlyExamples:examples.filter(row=>row.identityScope==='RESEARCH_HISTORICAL').length}),temporalSafety:Object.freeze({evidenceSeasonUsageOnly:true,outcomeNextSeasonPreseasonAdp:true,nextSeasonUsageAsPredictor:false,nextSeasonDevelopmentAsPredictor:false,nextSeasonProductionAsPredictor:false}),readiness:Object.freeze({readyUsage:Object.freeze(readyUsage),readyDevelopment:Object.freeze(readyDevelopment),readyInteractions:Object.freeze(readyInteractions),headroomRobustSignal:hasHeadroomRobustSignal,compositeCreated:false,currentPlayersScored:false,decision:go?'GO — BUILD CHAMPIONSHIP EQUITY SHADOW COMPOSITE':'NO-GO — CURRENT EVIDENCE DOES NOT SUPPORT A COMPOSITE'}),browserBundleIncreaseBytes:0,finalDecision:go?'GO — BUILD CHAMPIONSHIP EQUITY SHADOW COMPOSITE':'NO-GO — CURRENT EVIDENCE DOES NOT SUPPORT A COMPOSITE'});
}

module.exports=Object.freeze({SPLITS,SIGNALS,INTERACTIONS,HEADROOM_BANDS,STABILITY_RULE,INTERACTION_FORMULA,headroomBand,buildExamples,metrics,classifyStability,transitionSummary,analyzeSignals,attachDevelopment,developmentSignals,interactionRows,analyzeInteractions,addProductionOutcomes,compareOutcomes,caseReviews,run});
