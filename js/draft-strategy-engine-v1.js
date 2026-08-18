/** Jōnin 4.3 gated draft strategy layer. Pure, deterministic, and source-provider agnostic. */
(function(root){
  'use strict';
  const TIERS=Object.freeze({S:0,A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,J:10,K:11,L:12,M:13,N:14,O:15});
  const finite=value=>Number.isFinite(Number(value))?Number(value):null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const pos=value=>{const p=String(value||'').trim().toUpperCase();return p==='DEF'||p==='D/ST'||p==='DEFENSE'?'DST':p};
  const tierIndex=value=>Object.prototype.hasOwnProperty.call(TIERS,String(value||'').toUpperCase())?TIERS[String(value).toUpperCase()]:null;
  function sourceRank(player){const rank=finite(player?.sourceRank??player?.fantasylandOverallRank??player?.overall);return rank!=null&&rank>=1?rank:null}
  function roleQuality(player){
    const position=pos(player?.position??player?.pos),rank=sourceRank(player),tier=tierIndex(player?.overallTier),positionRank=finite(player?.positionRank??player?.fantasylandPositionRank??player?.posRank);
    if(['K','DST'].includes(position))return'REQUIRED_SPECIALIST';
    if(rank==null)return'UNKNOWN';
    if(position==='RB')return rank<=30||tier!=null&&tier<=2?'FOUNDATION':rank<=70||positionRank!=null&&positionRank<=28?'STARTER':rank<=145?'DEPTH':'CONTINGENCY';
    if(position==='WR')return rank<=36||tier!=null&&tier<=2?'FOUNDATION':rank<=85||positionRank!=null&&positionRank<=40?'STARTER':rank<=160?'DEPTH':'CONTINGENCY';
    if(position==='QB')return rank<=70||positionRank!=null&&positionRank<=10?'STARTER':rank<=140?'DEPTH':'CONTINGENCY';
    if(position==='TE')return rank<=80||positionRank!=null&&positionRank<=10?'STARTER':rank<=150?'DEPTH':'CONTINGENCY';
    return'UNKNOWN';
  }
  function valueCorridor({player,pick,round,leagueSize=10,tierCliff=false,completionForced=false}){
    const rank=sourceRank(player),position=pos(player?.position??player?.pos),stage=Number(round)||Math.ceil(Number(pick||1)/Number(leagueSize||10));
    const base=stage<=2?8:stage<=5?12:stage<=10?18:26,allowance=base+(tierCliff?4:0)+Math.max(0,(Number(leagueSize)-10)/2),reach=rank==null?null:rank-Number(pick);
    const specialist=['K','DST'].includes(position),inside=rank!=null&&reach<=allowance,justification=completionForced?'MATHEMATICAL_COMPLETION':tierCliff?'FINAL_MEANINGFUL_TIER':reach!=null&&reach<=allowance?'WITHIN_VALUE_CORRIDOR':reach!=null&&reach<0?'VALUE_FALL':null;
    const hardRejected=!completionForced&&!specialist&&(rank==null||reach>allowance+15);
    return Object.freeze({rank,reach,allowance,inside:inside||completionForced||specialist,hardRejected,justification:justification||(hardRejected?'UNEXPLAINED_REACH':'OUTSIDE_NORMAL_CORRIDOR')});
  }
  function priceOfAcquisition(input){
    const rank=sourceRank(input.player),pick=Number(input.pick||1),picksUntil=Math.max(0,Number(input.picksUntil||0)),sameTierRemaining=Math.max(0,Number(input.sameTierRemaining||0)),expectedPositionSelections=Math.max(0,Number(input.expectedPositionSelections||0)),nextTierDrop=Math.max(0,Number(input.nextTierDrop||0)),survivalRisk=Math.max(0,Number(input.survivalRisk||0)),meaningfulTierCliff=input.tierCliff===true&&sameTierRemaining<=Math.max(1,expectedPositionSelections)&&nextTierDrop>=1,corridor=valueCorridor({...input,tierCliff:meaningfulTierCliff}),reach=rank==null?null:rank-pick,smallLimit=Math.max(6,Math.floor(corridor.allowance/2)),extremeLimit=corridor.allowance+15;
    const band=reach==null?'UNKNOWN':reach<=5?'NORMAL':reach<=smallLimit?'SMALL_REACH':reach<=extremeLimit?'MATERIAL_REACH':'EXTREME_REACH',nextPick=pick+picksUntil,survival=rank==null?'UNKNOWN':rank>=nextPick?'LIKELY_TO_SURVIVE':rank>pick?'UNCERTAIN':'UNLIKELY_TO_SURVIVE',portfolioSignals=input.portfolio?.signals||[],strongPortfolio=portfolioSignals.filter(signal=>['LEAGUE_BREAKER_UPSIDE','DOCUMENTED_CORE_TARGET','ROLE_GROWTH_PATH','SECURE_ROLE'].includes(signal)),signals=[];
    if(Number(input.starterImpact)>0)signals.push('STARTER_EQUITY_IMPROVEMENT');
    if(meaningfulTierCliff)signals.push('MEANINGFUL_TIER_PRESERVATION');
    if(survivalRisk>=60||survival==='UNLIKELY_TO_SURVIVE')signals.push('LOW_SURVIVAL');
    signals.push(...strongPortfolio);
    const basePenalty=band==='SMALL_REACH'?Math.max(0,(reach-5)*.35):band==='MATERIAL_REACH'?1.5+Math.max(0,reach-smallLimit)*.55:band==='EXTREME_REACH'?4+Math.max(0,reach-corridor.allowance)*.55:0,waitPenalty=survival==='LIKELY_TO_SURVIVE'&&reach>5&&!meaningfulTierCliff?Math.min(5,.75+Math.max(0,rank-nextPick)*.25):0,relief=Math.min((basePenalty+waitPenalty)*.5,(Number(input.starterImpact)>0?1.25:0)+(meaningfulTierCliff?2.5:0)+(survivalRisk>=60||survival==='UNLIKELY_TO_SURVIVE'?2:0)+Math.min(2,strongPortfolio.length)),material=['MATERIAL_REACH','EXTREME_REACH'].includes(band),extraordinary=meaningfulTierCliff&&(survivalRisk>=60||survival==='UNLIKELY_TO_SURVIVE'||Number(input.starterImpact)>0),unsupported=material&&signals.length===0,blocked=band==='EXTREME_REACH'&&!extraordinary&&!input.completionForced,penalty=Math.max(0,basePenalty+waitPenalty-relief)+(unsupported?4:0)+(blocked?6:0);
    return Object.freeze({rank,reach,band,smallLimit,extremeLimit,nextPick,survival,likelyToSurvive:survival==='LIKELY_TO_SURVIVE',meaningfulTierCliff,sameTierRemaining,expectedPositionSelections,nextTierDrop,survivalRisk,signals:Object.freeze(signals),unsupported,blocked,basePenalty,waitPenalty,relief,penalty,corridor});
  }
  function foundationDebt({roster=[],round=1,config={}}){
    const premiumRB=roster.filter(player=>pos(player?.position??player?.pos)==='RB'&&roleQuality(player)==='FOUNDATION').length;
    const starterRB=roster.filter(player=>pos(player?.position??player?.pos)==='RB'&&['FOUNDATION','STARTER'].includes(roleQuality(player))).length;
    const requiredRB=Math.max(0,Number(config.startRB??2)),target=Math.min(requiredRB,Number(round)<=1?1:2),debt=Math.max(0,target-premiumRB),severity=debt===0?'NONE':debt===1?'MEANINGFUL':'HIGH';
    return Object.freeze({premiumRB,starterRB,target,debt,severity});
  }
  function slotQuality(player){const role=roleQuality(player);return({FOUNDATION:5,STARTER:3,DEPTH:1,CONTINGENCY:0,UNKNOWN:0,REQUIRED_SPECIALIST:1}[role]??0)}
  function starterEquity({roster=[],candidate=null,config={}}){
    const players=candidate?[...roster,candidate]:[...roster],requirements={QB:Number(config.startQB??1),RB:Number(config.startRB??2),WR:Number(config.startWR??3),TE:Number(config.startTE??1)},slots={},unused=[];let total=0,weak=0;
    for(const [position,count] of Object.entries(requirements)){const all=players.filter(player=>pos(player?.position??player?.pos)===position).map(slotQuality).sort((a,b)=>b-a),values=all.slice(0,count);unused.push(...(['RB','WR','TE'].includes(position)?all.slice(count):[]));while(values.length<count)values.push(0);slots[position]=values;total+=values.reduce((a,b)=>a+b,0);weak+=values.filter(value=>value<=1).length}
    const flexCount=Number(config.flex??2),flexValues=unused.sort((a,b)=>b-a).slice(0,flexCount);while(flexValues.length<flexCount)flexValues.push(0);slots.FLEX=flexValues;total+=flexValues.reduce((a,b)=>a+b,0);weak+=flexValues.filter(value=>value<=1).length;
    return Object.freeze({score:total,weakSlots:weak,slots,classification:weak>=3?'MAJOR_WEAKNESS':weak===2?'WEAK':weak===1?'AVERAGE':total>=sumRequirements(requirements)*4?'ELITE':'STRONG'});
  }
  function sumRequirements(requirements){return Object.values(requirements).reduce((sum,value)=>sum+value,0)}
  function recoveryCost({position,candidates=[],picksUntil=0,roster=[],round=1,config={}}){
    const positionCandidates=candidates.filter(player=>pos(player?.position??player?.pos)===pos(position)&&sourceRank(player)!=null).sort((a,b)=>sourceRank(a)-sourceRank(b)),current=positionCandidates[0],replacement=positionCandidates[Math.min(positionCandidates.length-1,Math.max(1,Math.floor(Number(picksUntil||0)*0.55)))],currentQuality=current?slotQuality(current):0,replacementQuality=replacement?slotQuality(replacement):0,rankLoss=current&&replacement?sourceRank(replacement)-sourceRank(current):0,unresolved=starterEquity({roster,config}).slots[pos(position)]?.some(value=>value<=1)??false;
    const cost=unresolved?clamp((currentQuality-replacementQuality)*2+rankLoss/12,0,8):0;
    return Object.freeze({position:pos(position),cost,currentPlayerId:current?.id??null,replacementPlayerId:replacement?.id??null,rankLoss,qualityLoss:currentQuality-replacementQuality,unresolved,round});
  }
  function benchPortfolioSignal({player,pick=1,round=1,roster=[],candidates=[]}){
    const rank=sourceRank(player),position=pos(player?.position??player?.pos),valueFall=rank==null?0:Math.max(0,Number(pick)-rank),signals=[];let offset=0;
    if(valueFall>=12){signals.push('HIGH_VALUE_FALL');offset+=Math.min(3,valueFall/10)}
    if(player?.leagueBreaker===true){signals.push('LEAGUE_BREAKER_UPSIDE');offset+=2}
    if(player?.coreTarget===true){signals.push('DOCUMENTED_CORE_TARGET');offset+=1.5}
    if(player?.rookie===true&&Number(round)>=8){signals.push('ROLE_GROWTH_PATH');offset+=1}
    if(String(player?.roleSecurity||'').toLowerCase()==='high'||player?.workhorse===true){signals.push('SECURE_ROLE');offset+=1}
    const rbCount=roster.filter(item=>pos(item?.position??item?.pos)==='RB').length,wrCount=roster.filter(item=>pos(item?.position??item?.pos)==='WR').length;
    if(['RB','WR'].includes(position)&&Math.abs(rbCount-wrCount)>=2&&((position==='RB'&&rbCount<wrCount)||(position==='WR'&&wrCount<rbCount))){signals.push('PORTFOLIO_DIVERSIFICATION');offset+=1}
    const alternateRanks=candidates.filter(candidate=>{const candidatePosition=pos(candidate?.position??candidate?.pos);return candidate?.id!==player?.id&&['RB','WR'].includes(candidatePosition)&&candidatePosition!==position}).map(sourceRank).filter(value=>value!=null),bestAlternateRank=alternateRanks.length?Math.min(...alternateRanks):null,availablePoolValueEdge=rank!=null&&bestAlternateRank!=null?bestAlternateRank-rank:0;
    if(Number(round)>=8&&availablePoolValueEdge>=18){signals.push('AVAILABLE_POOL_VALUE_EDGE');offset+=clamp(availablePoolValueEdge/12,1.5,3)}
    return Object.freeze({offset:clamp(offset,0,5),valueFall,availablePoolValueEdge,bestAlternateRank,signals,documented:signals.length>0});
  }
  function positionalMarginalUtility({player,roster=[],candidates=[],config={},pick=1,round=1,starterImpact=0}){
    const position=pos(player?.position??player?.pos),countBefore=roster.filter(item=>pos(item?.position??item?.pos)===position).length,ordinal=countBefore+1,portfolio=benchPortfolioSignal({player,pick,round,roster,candidates});
    const penaltyTables={WR:{4:0.5,5:1.5,6:8,7:13,8:18},RB:{3:0,4:2.5,5:6,6:9,7:13,8:18},QB:{2:5,3:10},TE:{2:2,3:6,4:9}},table=penaltyTables[position]||{},keys=Object.keys(table).map(Number).sort((a,b)=>a-b),threshold=keys.filter(key=>ordinal>=key).pop(),rawPenalty=threshold==null?0:table[threshold];
    const improvesStarter=Number(starterImpact)>0,starterRelief=improvesStarter?rawPenalty*.8:0,exceptionRelief=Math.min(Math.max(0,rawPenalty-starterRelief),portfolio.offset),netPenalty=Math.max(0,rawPenalty-starterRelief-exceptionRelief),utility=improvesStarter?'STARTER_IMPROVEMENT':netPenalty>=7?'SATURATED':netPenalty>=3?'LOW':netPenalty>0?'DECLINING':'HIGH';
    return Object.freeze({position,countBefore,ordinal,rawPenalty,starterRelief,exceptionRelief,netPenalty,adjustment:-netPenalty,utility,improvesStarter,portfolio});
  }
  function evaluateCandidate(input){
    const player=input.player||{},position=pos(player.position??player.pos),round=Number(input.round)||1,roster=input.roster||[],candidates=input.candidates||[],role=roleQuality(player),debt=foundationDebt({roster,round,config:input.config}),before=starterEquity({roster,config:input.config}),after=starterEquity({roster,candidate:player,config:input.config}),starterImpact=after.score-before.score,recovery=recoveryCost({position:'RB',candidates,picksUntil:input.picksUntil,roster,round,config:input.config});
    const premiumRB=position==='RB'&&role==='FOUNDATION',ordinaryDepth=['DEPTH','CONTINGENCY','UNKNOWN'].includes(role),premiumAvailable=candidates.some(candidate=>pos(candidate.pos??candidate.position)==='RB'&&roleQuality(candidate)==='FOUNDATION'&&valueCorridor({...input,player:candidate}).inside);
    const personalizedFoundation=input.personalizedFoundation!==false,foundationAdjustment=!personalizedFoundation?0:premiumRB&&debt.debt?Math.min(6,debt.debt*3):position!=='RB'&&debt.debt&&premiumAvailable&&round<=3?-Math.min(4,recovery.cost):0;
    const starterAdjustment=clamp(starterImpact*1.25,-3,5),pathAdjustment=clamp((premiumRB?recovery.cost:0)+(starterImpact>0?1:0),0,5);
    const marginalUtility=positionalMarginalUtility({player,roster,candidates,config:input.config,pick:input.pick,round,starterImpact}),surplusDepthPenalty=marginalUtility.netPenalty;
    const acquisition=priceOfAcquisition({...input,player,starterImpact,portfolio:marginalUtility.portfolio}),corridor=acquisition.corridor;
    const chaseDetected=position==='RB'&&debt.debt>0&&ordinaryDepth&&!corridor.inside,depthBeforeStarters=ordinaryDepth&&before.weakSlots>0&&after.weakSlots>=before.weakSlots;
    const saturationNeedsAlternative=marginalUtility.utility==='SATURATED'&&!marginalUtility.portfolio.documented&&!marginalUtility.improvesStarter,bestAlternativeByPosition=saturationNeedsAlternative?candidates.filter(candidate=>candidate?.id!==player?.id&&['QB','RB','WR','TE'].includes(pos(candidate?.position??candidate?.pos))).reduce((memo,candidate)=>{const candidatePosition=pos(candidate?.position??candidate?.pos),current=memo[candidatePosition];if(!current||(sourceRank(candidate)??Infinity)<(sourceRank(current)??Infinity))memo[candidatePosition]=candidate;return memo},{}):{},saturationAlternatives=Object.values(bestAlternativeByPosition).map(candidate=>{const alternativeCorridor=valueCorridor({...input,player:candidate}),alternativeAfter=starterEquity({roster,candidate,config:input.config}),alternativeImpact=alternativeAfter.score-before.score,utility=positionalMarginalUtility({player:candidate,roster,config:input.config,pick:input.pick,round,starterImpact:alternativeImpact});return{playerId:candidate.id,corridor:alternativeCorridor,starterImpact:alternativeImpact,netPenalty:utility.netPenalty,utility:utility.utility}}).filter(alternative=>alternative.corridor.inside&&!alternative.corridor.hardRejected),betterSaturationAlternative=saturationAlternatives.some(alternative=>alternative.starterImpact>starterImpact||alternative.netPenalty<=marginalUtility.netPenalty-2),leastSaturatedAvailable=saturationNeedsAlternative&&!betterSaturationAlternative;
    const unsupportedSaturation=saturationNeedsAlternative&&betterSaturationAlternative,reachPenalty=-acquisition.penalty,depthPenalty=(depthBeforeStarters?-3:0)+marginalUtility.adjustment,chasePenalty=chaseDetected?-7:0,integrityPenalty=unsupportedSaturation?-4:0;
    const adjustment=foundationAdjustment+starterAdjustment+pathAdjustment+reachPenalty+depthPenalty+chasePenalty+integrityPenalty;
    const defensible=!corridor.hardRejected&&!chaseDetected&&!unsupportedSaturation&&!acquisition.blocked&&!acquisition.unsupported,confidence=clamp(70+(corridor.inside?8:-18)+(starterImpact>0?7:-4)+(premiumRB&&debt.debt?6:0)-(chaseDetected?20:0)-(unsupportedSaturation?15:0)-(acquisition.unsupported||acquisition.blocked?18:0),10,95);
    return Object.freeze({score:Math.max(1,Number(input.baseScore||0)+adjustment),adjustment,role,corridor,priceOfAcquisition:acquisition,debt,recovery,starterEquity:{before,after,impact:starterImpact},marginalUtility,benchPortfolio:marginalUtility.portfolio,pathPreservation:{adjustment:pathAdjustment,viablePremiumRBPaths:candidates.filter(candidate=>pos(candidate.pos??candidate.position)==='RB'&&roleQuality(candidate)==='FOUNDATION'&&valueCorridor({...input,player:candidate}).inside).length},integrity:Object.freeze({defensible,chaseDetected,unsupportedSaturation,unsupportedAcquisition:acquisition.unsupported,blockedAcquisition:acquisition.blocked,leastSaturatedAvailable,depthBeforeStarters,surplusDepthPenalty,confidence,reasons:[corridor.justification,acquisition.band!=='NORMAL'?acquisition.band:null,...acquisition.signals,premiumRB&&debt.debt&&personalizedFoundation?'PRESERVES_RB_FOUNDATION':null,starterImpact>0?'IMPROVES_STARTER_EQUITY':null,chaseDetected?'DO_NOT_CHASE':null,surplusDepthPenalty?'DIMINISHING_DEPTH_UTILITY':null,marginalUtility.portfolio.documented?'DOCUMENTED_BENCH_UPSIDE':null,leastSaturatedAvailable?'LEAST_SATURATED_AVAILABLE_PATH':null,unsupportedSaturation?'UNJUSTIFIED_DEPTH_SATURATION':null,acquisition.unsupported?'UNJUSTIFIED_MATERIAL_REACH':null,acquisition.blocked?'EXTREME_REACH_BLOCKED':null].filter(Boolean)})});
  }
  const api=Object.freeze({sourceRank,tierIndex,roleQuality,valueCorridor,priceOfAcquisition,foundationDebt,starterEquity,recoveryCost,benchPortfolioSignal,positionalMarginalUtility,evaluateCandidate});root.DraftStrategyEngineV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
