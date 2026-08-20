'use strict';

const Analysis=require('../breakout-backtest/analysis');
const Features=require('../breakout-backtest/features');
const Development=require('../historical-development');
const ExpandedValidation=require('../expanded-market-validation');

const SUPPORTED_POSITIONS=Object.freeze(['RB','WR']);
const UNSUPPORTED_POSITIONS=Object.freeze({QB:'INSUFFICIENT_VALIDATED_SIGNAL_SET',TE:'INSUFFICIENT_VALIDATED_SIGNAL_SET'});
const SCORE_BANDS=Object.freeze({HIGH:75,MODERATE:50});
const FORMULAS=Object.freeze({
  RB:Object.freeze([
    Object.freeze({component:'yardsPerCarry',source:'VALIDATED_USAGE',weight:.50,direction:1}),
    Object.freeze({component:'ageAtSeason',source:'VALIDATED_DEVELOPMENT',weight:.25,direction:-1}),
    Object.freeze({component:'yearInLeague',source:'VALIDATED_DEVELOPMENT',weight:.25,direction:-1}),
  ]),
  WR:Object.freeze([
    Object.freeze({component:'lateTargets',source:'VALIDATED_USAGE',weight:.35,direction:1}),
    Object.freeze({component:'ageAtSeason',source:'VALIDATED_DEVELOPMENT',weight:.15,direction:-1}),
    Object.freeze({component:'yearInLeague',source:'VALIDATED_DEVELOPMENT',weight:.15,direction:-1}),
    Object.freeze({component:'lateTargets×ageAtSeason',source:'VALIDATED_INTERACTION',weight:.20,direction:1,usageFeature:'lateTargets',developmentFeature:'ageAtSeason'}),
    Object.freeze({component:'targetGrowth×ageAtSeason',source:'VALIDATED_INTERACTION',weight:.15,direction:1,usageFeature:'targetGrowth',developmentFeature:'ageAtSeason'}),
  ]),
});
const EVIDENCE_CUTOFF=Object.freeze({usageSeason:2025,evaluationSeason:2026,usageSource:'nflverse',futureUsageAllowed:false});
const round=value=>Number.isFinite(value)?Number(value.toFixed(4)):null;
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const median=values=>quantile(values,.5);
const quantile=(values,q)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),index=(sorted.length-1)*q,lower=Math.floor(index),fraction=index-lower;return sorted[lower]+(sorted[lower+1]===undefined?0:fraction*(sorted[lower+1]-sorted[lower]))};

function percentileMaps(rows,definitions){
  const result={},baseDefinitions=new Map();
  for(const definition of definitions){
    if(definition.source!=='VALIDATED_INTERACTION')baseDefinitions.set(definition.component,definition);
    else{baseDefinitions.set(definition.usageFeature,{component:definition.usageFeature,direction:1});baseDefinitions.set(definition.developmentFeature,{component:definition.developmentFeature,direction:-1});}
  }
  for(const definition of baseDefinitions.values()){
    const usable=rows.filter(row=>finite(row.values[definition.component])!==null),ranks=Analysis.ranks(usable.map(row=>finite(row.values[definition.component])*definition.direction)),denominator=Math.max(usable.length-1,1);
    result[definition.component]=new Map(usable.map((row,index)=>[row,round(100*(ranks[index]-1)/denominator)]));
  }
  for(const definition of definitions.filter(item=>item.source==='VALIDATED_INTERACTION')){
    const usage=result[definition.usageFeature],development=result[definition.developmentFeature],usable=rows.filter(row=>usage?.has(row)&&development?.has(row));
    result[definition.component]=new Map(usable.map(row=>[row,round(.75*usage.get(row)+.25*development.get(row))]));
  }
  return result;
}

function scoreBand(score){return score===null?'INSUFFICIENT_DATA':score>=SCORE_BANDS.HIGH?'HIGH':score>=SCORE_BANDS.MODERATE?'MODERATE':'LOW'}
function expertRank(player){return finite(player?.fantasylandOverallRank??player?.overall)}
function expertTier(player){const value=String(player?.fantasylandOverallTier??player?.overallTier??'').trim();return value||null}
function expertRankBand(rank){return rank===null?'UNKNOWN':rank<=24?'PICKS_1_24':rank<=60?'PICKS_25_60':rank<=120?'PICKS_61_120':'PICKS_121_PLUS'}
function marketHeadroom({adp=null,rank=null}={}){
  const currentAdp=finite(adp);
  if(currentAdp!==null)return Object.freeze({status:'AVAILABLE',currentAdp,band:ExpandedValidation.headroomBand(currentAdp),scoreAdjustment:0,note:'Market headroom is reported separately and does not alter the shadow score.'});
  return Object.freeze({status:'CURRENT_2026_ADP_UNAVAILABLE',currentAdp:null,band:null,expertRankContext:rank,expertRankBand:expertRankBand(rank),scoreAdjustment:0,note:'Expert rank is context only and is not substituted for ADP or used in the score.'});
}
function reachFirewall({status,score,tier,rank}={}){
  const usable=status!=='INSUFFICIENT_DATA'&&!String(status).startsWith('INSUFFICIENT_VALIDATED');
  return Object.freeze({currentTier:tier??null,currentRank:rank??null,sameTierTie:usable?'ELIGIBLE_AS_NON_AUTHORITATIVE_TIE_BREAK_EVIDENCE':'NOT_SUPPORTED',modestOneTierGap:usable&&score>=SCORE_BANDS.HIGH?'ELIGIBLE_FOR_GUARDED_REVIEW':'NOT_SUPPORTED',multiTierGap:'PROHIBITED',active:false,recommendationAuthority:false});
}

function explain(position,components,headroom){
  if(!components.length)return Object.freeze(['Validated scoring inputs are incomplete.']);
  const ordered=[...components].sort((a,b)=>b.contribution-a.contribution),phrases=[];
  const label={yardsPerCarry:'historical rushing efficiency',lateTargets:'late-season target demand',ageAtSeason:'favorable age context',yearInLeague:'favorable career stage','lateTargets×ageAtSeason':'age-adjusted late target demand','targetGrowth×ageAtSeason':'age-adjusted target growth'};
  for(const component of ordered.slice(0,2))phrases.push(`${label[component.component]} contributes ${component.contribution.toFixed(1)} points`);
  if(headroom.status==='AVAILABLE')phrases.push(`market cost falls in ${headroom.band.replaceAll('_',' ').toLowerCase()}`);else phrases.push('current 2026 ADP is unavailable; expert rank is context only');
  return Object.freeze(phrases.map((text,index)=>`${index?'Supporting':'Primary'}: ${text}.`));
}

function scoreCohort(rows,position){
  const definitions=FORMULAS[position];if(!definitions)return Object.freeze(rows.map(row=>Object.freeze({...row,status:UNSUPPORTED_POSITIONS[position]||'UNSUPPORTED_POSITION',score:null,classification:'INSUFFICIENT_DATA',components:Object.freeze([])})));
  const maps=percentileMaps(rows,definitions);
  return Object.freeze(rows.map(row=>{
    const components=definitions.map(definition=>{const percentile=maps[definition.component]?.get(row);if(percentile===undefined)return null;const interaction=definition.source==='VALIDATED_INTERACTION',inputs=interaction?Object.freeze({usageFeature:definition.usageFeature,usagePercentile:maps[definition.usageFeature].get(row),developmentFeature:definition.developmentFeature,developmentPercentile:maps[definition.developmentFeature].get(row),formula:'0.75 usage percentile + 0.25 favorable-age percentile'}):null;return Object.freeze({component:definition.component,source:definition.source,rawValue:interaction?percentile:finite(row.values[definition.component]),percentile,weight:definition.weight,contribution:round(percentile*definition.weight),inputs});});
    const missing=definitions.filter((definition,index)=>!components[index]).map(item=>item.component),complete=!missing.length,score=complete?round(components.reduce((sum,item)=>sum+item.contribution,0)):null;
    return Object.freeze({...row,status:complete?'SCORED':'INSUFFICIENT_DATA',score,classification:scoreBand(score),components:Object.freeze(components.filter(Boolean)),dataCompleteness:Object.freeze({required:definitions.length,available:definitions.length-missing.length,missing:Object.freeze(missing),complete})});
  }));
}

function scoreRows(rows){
  const scored=[];for(const position of [...SUPPORTED_POSITIONS,...Object.keys(UNSUPPORTED_POSITIONS)])for(const season of [...new Set(rows.filter(row=>row.position===position).map(row=>row.evidenceSeason))].sort())scored.push(...scoreCohort(rows.filter(row=>row.position===position&&row.evidenceSeason===season),position));
  return Object.freeze(scored);
}

function currentEvidenceRows({players=[],usageSnapshot,developmentSnapshot}={}){
  const usage=new Map((usageSnapshot?.players||[]).filter(row=>row.season===EVIDENCE_CUTOFF.usageSeason).map(row=>[String(row.canonicalPlayerId),row])),metadata=new Map((developmentSnapshot?.players||[]).map(row=>[String(row.canonicalPlayerId),row]));
  return Object.freeze(players.filter(player=>['QB','RB','WR','TE'].includes(String(player.pos||player.position).toUpperCase())).map(player=>{
    const canonicalPlayerId=String(player.id),position=String(player.pos||player.position).toUpperCase(),usageRecord=usage.get(canonicalPlayerId),development=metadata.get(canonicalPlayerId),features=usageRecord?Features.extractFeatures(usageRecord,{evidenceSeason:EVIDENCE_CUTOFF.usageSeason}):null,ageAtSeason=Development.ageOnSeasonStart(development?.birthDate,EVIDENCE_CUTOFF.evaluationSeason),yearInLeague=Development.yearInLeague(development?.nflEntryYear,EVIDENCE_CUTOFF.evaluationSeason);
    return Object.freeze({canonicalPlayerId,playerName:player.name,position,evidenceSeason:EVIDENCE_CUTOFF.usageSeason,evaluationSeason:EVIDENCE_CUTOFF.evaluationSeason,player,values:Object.freeze({...features?.values,ageAtSeason,yearInLeague}),usageRecord,developmentMetadata:development||null});
  }));
}

function distribution(rows){
  const scores=rows.map(row=>row.score).filter(value=>value!==null),counts={HIGH:0,MODERATE:0,LOW:0,INSUFFICIENT_DATA:rows.length-scores.length};for(const score of scores)counts[scoreBand(score)]++;
  return Object.freeze({total:rows.length,scored:scores.length,missing:rows.length-scores.length,min:round(Math.min(...scores)),p25:round(quantile(scores,.25)),median:round(median(scores)),p75:round(quantile(scores,.75)),max:round(Math.max(...scores)),mean:round(mean(scores)),classifications:Object.freeze(counts)});
}

function historicalRetro({normalizedAdp,usageSnapshot,developmentSnapshot,players=[]}={}){
  const examples=ExpandedValidation.buildExamples({normalizedAdp,usageSnapshot,players});
  const attached=ExpandedValidation.attachDevelopment(examples,developmentSnapshot).map(row=>Object.freeze({...row,values:Object.freeze({...row.features.values,ageAtSeason:row.development.ageAtSeason,yearInLeague:row.development.yearInLeague})}));
  const scored=scoreRows(attached).filter(row=>SUPPORTED_POSITIONS.includes(row.position)),usable=scored.filter(row=>row.score!==null),metricRows=usable.map(row=>Object.freeze({...row,features:Object.freeze({values:Object.freeze({score:row.score})}),outcome:row.market}));
  const summarize=rows=>{const values=rows.map(row=>row.score);return Object.freeze({n:rows.length,min:round(Math.min(...values)),median:round(median(values)),max:round(Math.max(...values)),mean:round(mean(values))})},result={};
  for(const position of SUPPORTED_POSITIONS){const rows=usable.filter(row=>row.position===position),positives=rows.filter(row=>row.market.isBreakout),negatives=rows.filter(row=>!row.market.isBreakout),high=rows.filter(row=>row.classification==='HIGH');result[position]=Object.freeze({distribution:distribution(scored.filter(row=>row.position===position)),auc:round(Analysis.auc(metricRows.filter(row=>row.position===position),'score',1)),baseRate:round(rows.length?positives.length/rows.length:null),highBandRate:round(high.length?high.filter(row=>row.market.isBreakout).length/high.length:null),appreciation:summarize(positives),noAppreciation:summarize(negatives)});}
  const compact=row=>Object.freeze({canonicalPlayerId:row.canonicalPlayerId,playerName:row.playerName,position:row.position,evidenceSeason:row.evidenceSeason,outcomeSeason:row.outcomeSeason,score:row.score,classification:row.classification,evidenceAdp:row.market.evidenceAdp,adpGain:row.market.adpGain,outcomeLabel:row.market.label});
  return Object.freeze({sampleSize:scored.length,scored:usable.length,positions:Object.freeze(result),knownHits:Object.freeze(usable.filter(row=>row.classification==='HIGH'&&row.market.isBreakout).sort((a,b)=>b.market.adpGain-a.market.adpGain).slice(0,15).map(compact)),falsePositives:Object.freeze(usable.filter(row=>row.classification==='HIGH'&&!row.market.isBreakout).sort((a,b)=>b.score-a.score).slice(0,15).map(compact)),falseNegatives:Object.freeze(usable.filter(row=>row.classification!=='HIGH'&&row.market.isBreakout).sort((a,b)=>b.market.adpGain-a.market.adpGain).slice(0,15).map(compact))});
}

function disagreement(evaluation,production){
  if(evaluation.score===null)return'INSUFFICIENT_SHADOW_DATA';const mamba=finite(production?.mambaScore),mambaLikes=mamba!==null&&mamba>=90,ceLikes=evaluation.classification==='HIGH';
  if(mambaLikes&&ceLikes)return'A_MAMBA_AND_CHAMPIONSHIP_EQUITY_ALIGN';
  if(mambaLikes&&evaluation.classification==='LOW')return'B_MAMBA_STRONG_CHAMPIONSHIP_EQUITY_WEAK';
  if(!mambaLikes&&ceLikes)return finite(production?.mambaGapToLeader)>=5&&!production?.openingRecommendationRank?'D_REACH_PROTECTION_REVIEW':'C_MAMBA_NEUTRAL_CHAMPIONSHIP_EQUITY_STRONG';
  return'NO_MATERIAL_DISAGREEMENT';
}

function currentEvaluations({players=[],usageSnapshot,developmentSnapshot,productionContext=[]}={}){
  const production=new Map(productionContext.map(row=>[String(row.id),row])),rows=currentEvidenceRows({players,usageSnapshot,developmentSnapshot}),scoredByKey=new Map(scoreRows(rows).map(row=>[row.canonicalPlayerId,row]));
  return Object.freeze(rows.map(row=>{const scored=scoredByKey.get(row.canonicalPlayerId),rank=expertRank(row.player),tier=expertTier(row.player),headroom=marketHeadroom({adp:null,rank}),prod=production.get(row.canonicalPlayerId),reach=reachFirewall({status:scored.status,score:scored.score,tier,rank});return Object.freeze({canonicalPlayerId:row.canonicalPlayerId,playerName:row.playerName,position:row.position,expertRank:rank,expertTier:tier,currentAdp:null,championshipEquityStatus:scored.status,shadowScore:scored.score,classification:scored.classification,components:scored.components,dataCompleteness:scored.dataCompleteness||Object.freeze({required:0,available:0,missing:Object.freeze([]),complete:false}),marketHeadroom:headroom,explanation:explain(row.position,scored.components,headroom),provenance:Object.freeze({usageSeason:row.usageRecord?.season??null,usageSource:row.usageRecord?.provenance?.source??usageSnapshot?.provider??null,usageSnapshotDate:row.usageRecord?.provenance?.snapshotDate??usageSnapshot?.snapshotDate??null,developmentSource:row.developmentMetadata?.source??null,developmentSnapshotDate:row.developmentMetadata?.snapshotDate??developmentSnapshot?.snapshotDate??null,future2026UsageUsed:false}),productionContext:prod?Object.freeze({mambaScore:prod.mambaScore,finalPickScore:prod.finalPickScore,openingRecommendationRank:prod.openingRecommendationRank??null,mambaGapToLeader:prod.mambaGapToLeader??null,source:'OFFLINE_PRODUCTION_HARNESS_PICK_1'}):null,disagreement:disagreement(scored,prod),reachFirewall:reach});}));
}

function run({players=[],usageSnapshot,developmentSnapshot,normalizedAdp,researchPlayers=[],validationBaseline,productionContext=[]}={}){
  const current=currentEvaluations({players,usageSnapshot,developmentSnapshot,productionContext}),retro=historicalRetro({normalizedAdp,usageSnapshot,developmentSnapshot,players:researchPlayers}),distributions=Object.freeze(Object.fromEntries(['RB','WR','QB','TE'].map(position=>[position,distribution(current.filter(row=>row.position===position).map(row=>({score:row.shadowScore})))]))),scored=current.filter(row=>row.shadowScore!==null),top=[...scored].sort((a,b)=>b.shadowScore-a.shadowScore||a.expertRank-b.expertRank||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)).slice(0,25),low=[...scored].sort((a,b)=>a.shadowScore-b.shadowScore||a.expertRank-b.expertRank||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)).slice(0,15),categories={};for(const row of current)categories[row.disagreement]=(categories[row.disagreement]||0)+1;
  const sane=SUPPORTED_POSITIONS.every(position=>{const value=distributions[position],high=value.classifications.HIGH,lowCount=value.classifications.LOW;return value.scored>=30&&high>=3&&lowCount>=3&&value.max-value.min>=35}),coherent=SUPPORTED_POSITIONS.every(position=>retro.positions[position].auc!==null&&retro.positions[position].auc>=.55&&retro.positions[position].highBandRate>=retro.positions[position].baseRate),ready=sane&&coherent;
  return Object.freeze({schemaVersion:1,milestone:'Jōnin 4.3.18',label:'Championship Equity Shadow Composite v1',mode:'OFFLINE_RESEARCH_SHADOW_ONLY',recommendationAuthority:false,formula:Object.freeze({normalization:'Within-position, within-evidence-season percentile ranks; ties receive average rank.',scoreBands:SCORE_BANDS,positions:FORMULAS,interactionFormula:'0.75 usage percentile + 0.25 favorable-age percentile',headroomScoreWeight:0}),validatedInputs:Object.freeze(validationBaseline?.readiness||{}),unsupportedPositions:UNSUPPORTED_POSITIONS,evidenceCutoff:EVIDENCE_CUTOFF,scoreDistribution:distributions,historicalRetro:retro,current2026:Object.freeze({totalPlayers:current.length,scoredPlayers:scored.length,evaluations:current,topCandidates:Object.freeze(top),lowOptionalityExamples:Object.freeze(low)}),disagreements:Object.freeze({counts:Object.freeze(categories),cases:Object.freeze(current.filter(row=>!['NO_MATERIAL_DISAGREEMENT','INSUFFICIENT_SHADOW_DATA'].includes(row.disagreement)).slice(0,50))}),reachFirewall:Object.freeze({active:false,policy:'Same-tier tie evidence is allowed; a one-tier gap requires HIGH shadow evidence for guarded review; multi-tier gaps are prohibited.',simulations:Object.freeze(current.map(row=>Object.freeze({canonicalPlayerId:row.canonicalPlayerId,playerName:row.playerName,...row.reachFirewall})))}),futureMapping:Object.freeze({bestValue:'UNCHANGED_PRICE_RANK_TIER_VALUE',highestUpside:'FUTURE_CANDIDATE_FOR_VALIDATED_CHAMPIONSHIP_EQUITY_EVIDENCE',bestPick:'UNCHANGED_OVERALL_SYNTHESIS',active:false}),calibrationSafety:Object.freeze({distributionSane:sane,retrospectiveCoherent:coherent,maximumSingleDirectWeight:.50,headroomWeight:0,coefficientsOptimized:false,playerSpecificTuning:false}),limitations:Object.freeze(['Market appreciation is not a calibrated league-winner probability.','No current 2026 ADP source is available; expert rank is context only.','TE and QB lack a validated signal set.','The validated RB and WR usage signals predicted market appreciation, not demonstrated production breakout.','Rookies and players without 2025 usage fail closed.']),productionIsolation:Object.freeze({bestPickChanged:false,recommendationOrderingChanged:false,decisionScoresChanged:false,bestValueChanged:false,highestUpsideChanged:false,archetypesChanged:false,gradingChanged:false,cpuDraftingChanged:false,browserImport:false}),browserBundleIncreaseBytes:0,finalDecision:ready?'READY FOR GUARDED SHADOW-TO-PRODUCTION EVALUATION':'SHADOW COMPOSITE NEEDS REVISION'});
}

module.exports=Object.freeze({SUPPORTED_POSITIONS,UNSUPPORTED_POSITIONS,SCORE_BANDS,FORMULAS,EVIDENCE_CUTOFF,percentileMaps,scoreBand,marketHeadroom,reachFirewall,scoreCohort,scoreRows,currentEvidenceRows,distribution,historicalRetro,disagreement,currentEvaluations,run});
