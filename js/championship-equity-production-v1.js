/** Jōnin 4.3.20 limited Championship Equity production authority. */
(function(root){
  'use strict';
  const STAGE_RULES=Object.freeze({
    EARLY:Object.freeze({sameTierRankCeiling:4,mambaValueGap:1}),
    MIDDLE:Object.freeze({sameTierRankCeiling:8,mambaValueGap:2}),
    LATE:Object.freeze({sameTierRankCeiling:12,mambaValueGap:3}),
    BENCH_BUILDING:Object.freeze({sameTierRankCeiling:18,mambaValueGap:3}),
  });
  const TIERS=Object.freeze(['S','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O']);
  const finite=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
  const clean=value=>String(value??'').trim();
  const freeze=value=>Object.freeze(value);
  let enabled=root.FantasyHQFeatureFlags?.championshipEquityProductionEnabled!==false,snapshot=null,index=new Map();

  function setEnabled(value){enabled=value===true;return enabled}
  function isEnabled(){return enabled}
  function loadSnapshot(value){
    if(!value||value.schemaVersion!==1||value.milestone!=='Jōnin 4.3.20'||!Array.isArray(value.players))throw new TypeError('Championship Equity production snapshot is invalid.');
    const next=new Map();
    for(const row of value.players){const id=clean(row.canonicalPlayerId);if(!id||next.has(id))throw new TypeError('Championship Equity production identity is missing or duplicated.');next.set(id,freeze({...row,components:freeze([...(row.components||[])]),provenance:freeze({...row.provenance})}))}
    snapshot=freeze({...value,players:freeze([...value.players])});index=next;return freeze({records:index.size,snapshotDate:value.snapshotDate,recommendationAuthority:value.recommendationAuthority});
  }
  function clearSnapshot(){snapshot=null;index=new Map()}
  function evidenceFor(playerOrId,position){
    const id=clean(playerOrId&&typeof playerOrId==='object'?(playerOrId.id??playerOrId.canonicalId):playerOrId),pos=clean(position??playerOrId?.pos??playerOrId?.position).toUpperCase();
    if(!id)return freeze({status:'MISSING_IDENTITY',canonicalPlayerId:null,position:pos||null,score:null,classification:'INSUFFICIENT_DATA',evidenceComplete:false,guardrailEligible:false,negativeAdjustment:0});
    if(['QB','TE'].includes(pos))return freeze({status:'INSUFFICIENT_VALIDATED_SIGNAL_SET',canonicalPlayerId:id,position:pos,score:null,classification:'INSUFFICIENT_DATA',evidenceComplete:false,guardrailEligible:false,negativeAdjustment:0});
    if(!['RB','WR'].includes(pos))return freeze({status:'UNSUPPORTED_POSITION',canonicalPlayerId:id,position:pos||null,score:null,classification:'INSUFFICIENT_DATA',evidenceComplete:false,guardrailEligible:false,negativeAdjustment:0});
    const row=index.get(id);if(!row)return freeze({status:'INCOMPLETE_EVIDENCE',canonicalPlayerId:id,position:pos,score:null,classification:'INSUFFICIENT_DATA',evidenceComplete:false,guardrailEligible:false,negativeAdjustment:0});
    const score=finite(row.score),complete=row.evidenceComplete===true&&score!==null&&row.position===pos;
    if(!complete)return freeze({...row,status:'INCOMPLETE_EVIDENCE',score:null,classification:'INSUFFICIENT_DATA',evidenceComplete:false,guardrailEligible:false,negativeAdjustment:0});
    return freeze({...row,status:'SUPPORTED',score,evidenceComplete:true,guardrailEligible:false,guardrailEligibility:enabled?'CONTEXT_REQUIRED':'FEATURE_FLAG_OFF',negativeAdjustment:0});
  }
  function draftStage(context={}){const round=Math.max(1,finite(context.currentRound)??1),total=Math.max(round,finite(context.totalRounds)??round),remaining=Math.max(0,finite(context.remainingStarterCapacity)??0);if(remaining===0&&round>1)return'BENCH_BUILDING';const progress=round/total;return progress<=1/3?'EARLY':progress<=2/3?'MIDDLE':'LATE'}
  function tierIndex(value){const result=TIERS.indexOf(clean(value).toUpperCase());return result<0?null:result}
  function comparison(incumbent,challenger){return freeze({tierGap:tierIndex(challenger.tier)===null||tierIndex(incumbent.tier)===null?null:tierIndex(challenger.tier)-tierIndex(incumbent.tier),rankGap:finite(challenger.rank)===null||finite(incumbent.rank)===null?null:finite(challenger.rank)-finite(incumbent.rank),mambaGap:finite(challenger.mamba)===null||finite(incumbent.mamba)===null?null:finite(incumbent.mamba)-finite(challenger.mamba),valueGap:finite(challenger.sourceValue)===null||finite(incumbent.sourceValue)===null?null:finite(incumbent.sourceValue)-finite(challenger.sourceValue),championshipEquityEdge:finite(challenger.evidence?.score)===null||finite(incumbent.evidence?.score)===null?null:finite(challenger.evidence.score)-finite(incumbent.evidence.score)})}
  function sameTierDecision({incumbent={},challenger={},context={}}={}){
    const stage=STAGE_RULES[context.draftStage]?context.draftStage:draftStage(context),rule=STAGE_RULES[stage],metrics=comparison(incumbent,challenger),result={enabled,recommendationAuthority:enabled,stage,rule,incumbentId:clean(incumbent.id),challengerId:clean(challenger.id),comparison:metrics,action:'UNCHANGED',eligible:false,reason:'NO_ELIGIBLE_CHAMPIONSHIP_EQUITY_INFLUENCE'};
    if(!enabled)return freeze({...result,reason:'FEATURE_FLAG_OFF'});
    if(!result.incumbentId||!result.challengerId||result.incumbentId===result.challengerId)return freeze({...result,reason:'IDENTITY_FAILURE'});
    if(incumbent.evidence?.status!=='SUPPORTED'||challenger.evidence?.status!=='SUPPORTED')return freeze({...result,reason:'INCOMPLETE_OR_UNSUPPORTED_EVIDENCE'});
    if(metrics.tierGap===null)return freeze({...result,reason:'MISSING_TIER'});
    if(metrics.tierGap>1)return freeze({...result,action:'PROHIBITED',reason:'MULTI_TIER_PROHIBITED'});
    if(metrics.tierGap===1)return freeze({...result,action:'GUARDED_REVIEW',reason:'ONE_TIER_NO_AUTOMATIC_AUTHORITY'});
    if(metrics.tierGap<0||metrics.rankGap<0||metrics.valueGap<0)return freeze({...result,action:'VALUE_UPSIDE_ALIGNMENT',reason:'EXISTING_VALUE_ALREADY_SUPPORTS_CHALLENGER'});
    if([metrics.rankGap,metrics.mambaGap,metrics.valueGap,metrics.championshipEquityEdge].some(value=>value===null))return freeze({...result,reason:'MISSING_COMPARISON_INPUT'});
    if(challenger.evidence.classification!=='HIGH'&&challenger.evidence.classification!=='MODERATE')return freeze({...result,reason:'NO_POSITIVE_EVIDENCE_BAND'});
    if(metrics.championshipEquityEdge<10)return freeze({...result,reason:'CHAMPIONSHIP_EQUITY_EDGE_NOT_DECISIVE'});
    if(metrics.rankGap>rule.sameTierRankCeiling||metrics.mambaGap>rule.mambaValueGap||metrics.valueGap>rule.mambaValueGap)return freeze({...result,reason:'SAME_TIER_BUDGET_EXCEEDED'});
    if(context.remainingStarterCapacity>0&&Number(incumbent.starterImpact||0)>Number(challenger.starterImpact||0))return freeze({...result,reason:'STARTER_FOUNDATION_PROTECTED'});
    if(incumbent.valuableRbDepth===true&&Number(challenger.starterImpact||0)<=Number(incumbent.starterImpact||0))return freeze({...result,reason:'VALUABLE_RB_DEPTH_PROTECTED'});
    if(challenger.survival==='LIKELY_TO_SURVIVE')return freeze({...result,action:'WAIT_FOR_PRICE',reason:'SURVIVAL_SUPPORTS_WAIT'});
    return freeze({...result,action:'TIE_BREAK_TO_CHAMPIONSHIP_EQUITY',eligible:true,reason:'BOUNDED_SAME_TIER_POSITIVE_EVIDENCE'});
  }
  function reorderBestPick({rows=[],context={}}={}){
    const ordered=[...rows];if(!enabled||ordered.length<2)return freeze({rows:freeze(ordered),decision:freeze({action:'UNCHANGED',eligible:false,reason:enabled?'NO_CHALLENGER':'FEATURE_FLAG_OFF'})});
    const incumbent=ordered[0],candidates=ordered.slice(1,5).map((challenger,order)=>({challenger,order,decision:sameTierDecision({incumbent,challenger,context})})).filter(item=>item.decision.eligible).sort((a,b)=>b.decision.comparison.championshipEquityEdge-a.decision.comparison.championshipEquityEdge||a.order-b.order),selected=candidates[0];
    if(!selected)return freeze({rows:freeze(ordered),decision:freeze({action:'UNCHANGED',eligible:false,reason:'NO_ELIGIBLE_SAME_TIER_CHALLENGER'})});
    const indexValue=ordered.findIndex(row=>clean(row.id)===clean(selected.challenger.id));ordered.splice(indexValue,1);ordered.unshift(selected.challenger);return freeze({rows:freeze(ordered),decision:selected.decision});
  }
  function selectHighestUpside({rows=[],baselinePlayerId=null,bestPickId=null,context={}}={}){
    const baseline=rows.find(row=>clean(row.id)===clean(baselinePlayerId))||null,best=rows.find(row=>clean(row.id)===clean(bestPickId))||rows[0]||null,result={playerId:baseline?clean(baseline.id):null,changed:false,reason:enabled?'NO_ELIGIBLE_CHAMPIONSHIP_EQUITY_UPSIDE':'FEATURE_FLAG_OFF',evidence:null};
    if(!enabled||!best)return freeze(result);
    const stage=STAGE_RULES[context.draftStage]?context.draftStage:draftStage(context),rule=STAGE_RULES[stage],baselineUpside=finite(baseline?.upsideScore),candidates=rows.filter(row=>row.evidence?.status==='SUPPORTED'&&row.evidence.classification==='HIGH').filter(row=>{const bestTier=tierIndex(best.tier),candidateTier=tierIndex(row.tier),rankGap=finite(row.rank)===null||finite(best.rank)===null?null:finite(row.rank)-finite(best.rank),mambaGap=finite(row.mamba)===null||finite(best.mamba)===null?null:finite(best.mamba)-finite(row.mamba),valueGap=finite(row.sourceValue)===null||finite(best.sourceValue)===null?null:finite(best.sourceValue)-finite(row.sourceValue);if(bestTier===null||candidateTier===null||candidateTier!==bestTier)return false;if([rankGap,mambaGap,valueGap].some(value=>value===null)||rankGap>rule.sameTierRankCeiling||mambaGap>rule.mambaValueGap||valueGap>rule.mambaValueGap)return false;if(context.remainingStarterCapacity>0&&Number(best.starterImpact||0)>Number(row.starterImpact||0))return false;if(best.valuableRbDepth===true&&Number(row.starterImpact||0)<=Number(best.starterImpact||0))return false;if(row.survival==='LIKELY_TO_SURVIVE')return false;const upside=finite(row.upsideScore);return baselineUpside===null||upside===null||upside>=baselineUpside-rule.mambaValueGap}).sort((a,b)=>(finite(b.evidence.score)??-Infinity)-(finite(a.evidence.score)??-Infinity)||(finite(b.upsideScore)??-Infinity)-(finite(a.upsideScore)??-Infinity)||Number(a.order)-Number(b.order)),selected=candidates[0];
    if(!selected)return freeze(result);const selectedId=clean(selected.id);return freeze({playerId:selectedId,changed:selectedId!==clean(baselinePlayerId),reason:'VALIDATED_MARKET_APPRECIATION_EVIDENCE_WITHIN_DRAFTABLE_SAME_TIER_CONTEXT',evidence:selected.evidence});
  }
  function status(){return freeze({enabled,snapshotLoaded:Boolean(snapshot),records:index.size,snapshotDate:snapshot?.snapshotDate??null,recommendationAuthority:enabled?'LIMITED':'OFF'})}
  const api=freeze({STAGE_RULES,setEnabled,isEnabled,loadSnapshot,clearSnapshot,evidenceFor,draftStage,sameTierDecision,reorderBestPick,selectHighestUpside,status});root.ChampionshipEquityProductionV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
