(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FantasyHQDiscoveryBreakoutRadarV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION='fantasy-hq-discovery-radar-1';
  const CLASSIFICATIONS=Object.freeze(['BREAKOUT','EMERGING','ROLE_GROWTH','OPPORTUNITY_WATCH','STASH_WATCH','STABLE','FADING','NOISE','INSUFFICIENT_EVIDENCE']);
  const STRENGTHS=Object.freeze(['STRONG','DEVELOPING','WEAK','NONE']);
  const TIMING=Object.freeze(['ACT','WATCH','WAIT','IGNORE']);
  const PRIORITY=Object.freeze({BREAKOUT:9,EMERGING:8,ROLE_GROWTH:7,OPPORTUNITY_WATCH:6,STASH_WATCH:5,STABLE:4,FADING:3,NOISE:2,INSUFFICIENT_EVIDENCE:1});
  const clean=value=>String(value??'').trim();
  const upper=value=>clean(value).toUpperCase().replace(/[ /-]+/g,'_');
  const freeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(freeze);return Object.freeze(value)};
  const clamp=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  const playerId=player=>clean(player?.canonicalPlayerId||player?.identity?.canonicalPlayerId||player?.seasonPlayerId||player?.playerId||player?.id);
  const playerIdentity=(player,record)=>freeze({
    playerId:playerId(player)||clean(record?.canonicalPlayerId),
    playerName:clean(player?.name||player?.canonicalName||record?.identity?.canonicalName)||'Unknown player',
    position:upper(player?.position||player?.pos||record?.position)||'UNKNOWN',
    team:upper(player?.nflTeam||player?.sourceTeam||player?.team||record?.nflTeam)||'UNKNOWN',
    identityType:upper(player?.identityType||player?.registryType)||(player?.seasonOnly===true?'SEASON_ONLY':'CANONICAL'),
    identityMethod:clean(player?.identityMethod||player?.discoveryProvenance?.method||record?.identity?.method)||'existing canonical identity',
  });
  const latestNumber=(records,path)=>{for(let index=records.length-1;index>=0;index--){const value=path.split('.').reduce((item,key)=>item?.[key],records[index]);if(value!==null&&value!==undefined&&Number.isFinite(Number(value)))return Number(value)}return null};
  const weeklyNumbers=(records,path)=>records.filter(record=>record.week!==null).map(record=>({week:record.week,value:path.split('.').reduce((item,key)=>item?.[key],record),id:record.evidenceId})).filter(row=>row.value!==null&&row.value!==undefined&&Number.isFinite(Number(row.value))).map(row=>({...row,value:Number(row.value)}));
  const changed=(series,direction)=>series.length>=3&&series.slice(-3).every((row,index,rows)=>index===0||(direction==='UP'?row.value>rows[index-1].value:row.value<rows[index-1].value));
  const sourceIds=records=>freeze([...new Set(records.map(record=>record.evidenceId).filter(Boolean))]);
  function freshness(records,store){
    if(!records.length)return'UNKNOWN';
    const states=[];
    for(const family of ['role','opportunity','production']){
      const latest=store.latest(records[0].canonicalPlayerId,family);
      if(latest.status==='CONFLICTED')return'CONFLICTED';
      if(latest.status==='AVAILABLE')states.push(latest.freshness);
    }
    if(states.includes('FRESH'))return'FRESH';
    if(states.includes('AGING'))return'AGING';
    if(states.length&&states.every(state=>state==='STALE'))return'STALE';
    return'UNKNOWN';
  }
  function productionSupport(records,roleUp,opportunityUp){
    const touchdowns=weeklyNumbers(records,'production.touchdowns'),points=weeklyNumbers(records,'production.fantasyPoints'),opportunities=weeklyNumbers(records,'opportunity.opportunities'),touches=weeklyNumbers(records,'opportunity.touches'),usage=opportunities.length?opportunities:touches;
    const latestTd=touchdowns.at(-1)?.value??null,latestUsage=usage.at(-1)?.value??null,priorUsage=usage.at(-2)?.value??null,latestPoints=points.at(-1)?.value??null,priorPoints=points.at(-2)?.value??null;
    const scoringSpike=latestTd!==null&&latestTd>=2&&(!roleUp&&!opportunityUp)&&(latestUsage===null||latestUsage<=4||priorUsage!==null&&latestUsage<=priorUsage);
    const pointsSpike=latestPoints!==null&&priorPoints!==null&&latestPoints>=Math.max(12,priorPoints*1.8)&&!roleUp&&!opportunityUp&&(latestUsage===null||priorUsage===null||latestUsage<=priorUsage);
    if(scoringSpike||pointsSpike)return freeze({status:'UNSUPPORTED_SPIKE',reason:'Production jumped without validated role or opportunity growth; touchdown or big-play noise is not treated as a breakout.',touchdownDependent:scoringSpike});
    if((roleUp||opportunityUp)&&(latestPoints!==null||latestTd!==null))return freeze({status:'SUPPORTED',reason:'Production is supported by a growing role or opportunity base.',touchdownDependent:false});
    return freeze({status:'UNCONFIRMED',reason:'Production support is incomplete; usage evidence remains primary.',touchdownDependent:false});
  }
  function synthesis(core){
    const label=core.classification.replaceAll('_',' ').toLowerCase();
    const whatChanged=core.roleTrend==='INCREASING'&&core.opportunityTrend==='INCREASING'?'Role and weekly opportunity have increased together.':core.roleTrend==='INCREASING'?'The player is earning a larger on-field role.':core.opportunityTrend==='INCREASING'?'Weekly opportunity is increasing.':core.roleTrend==='DECLINING'||core.opportunityTrend==='DECLINING'?'Recent role or opportunity is declining.':core.productionSupport==='UNSUPPORTED_SPIKE'?'Recent production rose without matching usage growth.':'No durable role or opportunity change is validated yet.';
    const whyItMatters=core.classification==='BREAKOUT'?'Persistent usage growth can create sustainable fantasy relevance.':core.classification==='EMERGING'?'The signal is developing, but needs another confirming observation.':core.classification==='FADING'?'Declining usage can reduce weekly fantasy reliability.':core.classification==='NOISE'?'The result is more likely to reflect scoring variance than a changed role.':`${label.charAt(0).toUpperCase()+label.slice(1)} is contextual NFL evidence, not a transaction recommendation.`;
    const whatToDo=core.timing==='ACT'?'Review current Yahoo availability and the existing Waiver engine now.':core.timing==='WATCH'?'Monitor the next usage report before making a roster decision.':core.timing==='WAIT'?'Wait for fresher or more complete evidence.':'No action is supported by this discovery signal.';
    const riskSummary=core.freshness==='STALE'?'Evidence is stale and must not be treated as live.':core.freshness==='CONFLICTED'?'Underlying sources conflict.':core.sampleQuality==='SINGLE_SAMPLE'?'Only one weekly sample is available.':core.productionSupport==='UNSUPPORTED_SPIKE'?'Touchdown or big-play production is not backed by usage growth.':'The signal remains observational and does not establish future performance.';
    return freeze({whatChanged,whyItMatters,whatToDo,riskSummary});
  }
  class DiscoveryBreakoutRadarV1{
    constructor({store,injuryEngine=null,registry=null,asOf=null}={}){if(!store||typeof store.observations!=='function')throw new TypeError('Discovery Radar requires a SeasonEvidenceStore');this.store=store;this.injuryEngine=injuryEngine;this.registry=registry;this.asOf=asOf||store.asOf;this.coreCache=new Map()}
    _registryPlayer(id){return this.registry?.get?.(id)||null}
    _core(player){
      const id=playerId(player),records=this.store.observations(id),cacheKey=`${id}:${records.length}:${records.at(-1)?.evidenceId||'none'}`;if(this.coreCache.has(cacheKey))return this.coreCache.get(cacheKey);
      const identity=playerIdentity(player||this._registryPlayer(id),records.at(-1)),role=this.store.roleSignal(id),opportunity=this.store.opportunitySignal(id),quality=this.store.signalQuality(id),fresh=freshness(records,this.store),weekly=records.filter(record=>record.week!==null),roleUp=role.status==='ROLE_INCREASING',oppUp=opportunity.status==='OPPORTUNITY_INCREASING',roleDown=role.status==='ROLE_DECLINING',oppDown=opportunity.status==='OPPORTUNITY_DECLINING',production=productionSupport(records,roleUp,oppUp),conflict=fresh==='CONFLICTED',stale=fresh==='STALE',sample=weekly.length>=3?'PERSISTENT':weekly.length===2?'DEVELOPING':weekly.length===1?'SINGLE_SAMPLE':'NONE';
      const snap=weeklyNumbers(records,'role.snapShare'),routes=weeklyNumbers(records,'role.routeParticipation'),opps=weeklyNumbers(records,'opportunity.opportunities'),touches=weeklyNumbers(records,'opportunity.touches'),targets=weeklyNumbers(records,'opportunity.targets'),targetShare=weeklyNumbers(records,'opportunity.targetShare'),carries=weeklyNumbers(records,'opportunity.carries'),rushShare=weeklyNumbers(records,'opportunity.rushShare'),validatedRoleUp=roleUp||changed(snap,'UP')||changed(routes,'UP'),validatedOppUp=oppUp||changed(opps,'UP')||changed(touches,'UP')||changed(targets,'UP')||changed(targetShare,'UP')||changed(carries,'UP')||changed(rushShare,'UP'),validatedDown=roleDown||oppDown||changed(snap,'DOWN')||changed(opps,'DOWN')||changed(touches,'DOWN')||changed(targetShare,'DOWN')||changed(rushShare,'DOWN');
      let classification='INSUFFICIENT_EVIDENCE',strength='NONE',timing='WAIT';
      if(conflict){classification='INSUFFICIENT_EVIDENCE';strength='NONE';timing='WAIT'}
      else if(production.status==='UNSUPPORTED_SPIKE'){classification='NOISE';strength='WEAK';timing='IGNORE'}
      else if(stale){classification=validatedDown?'FADING':weekly.length?'STABLE':'INSUFFICIENT_EVIDENCE';strength='WEAK';timing='WAIT'}
      else if(validatedDown&&sample==='PERSISTENT'){classification='FADING';strength='DEVELOPING';timing='WATCH'}
      else if(validatedRoleUp&&validatedOppUp&&sample==='PERSISTENT'&&production.status==='SUPPORTED'){classification='BREAKOUT';strength='STRONG';timing='ACT'}
      else if(validatedRoleUp&&validatedOppUp){classification='EMERGING';strength=sample==='PERSISTENT'?'STRONG':'DEVELOPING';timing='WATCH'}
      else if(validatedRoleUp){classification='ROLE_GROWTH';strength=sample==='PERSISTENT'?'STRONG':'DEVELOPING';timing='WATCH'}
      else if(validatedOppUp){classification='OPPORTUNITY_WATCH';strength=sample==='PERSISTENT'?'STRONG':'DEVELOPING';timing='WATCH'}
      else if(identity.identityType==='SEASON_ONLY'&&weekly.length){classification='STASH_WATCH';strength='WEAK';timing='WAIT'}
      else if(weekly.length>=3){classification='STABLE';strength='WEAK';timing='IGNORE'}
      let confidence=20+(sample==='PERSISTENT'?35:sample==='DEVELOPING'?22:sample==='SINGLE_SAMPLE'?8:0)+(fresh==='FRESH'?20:fresh==='AGING'?10:0)+(strength==='STRONG'?15:strength==='DEVELOPING'?8:0)-(conflict?35:0)-(production.status==='UNSUPPORTED_SPIKE'?12:0);
      if(stale)confidence=Math.min(confidence,35);if(classification==='INSUFFICIENT_EVIDENCE')confidence=Math.min(confidence,25);
      const core=freeze({schemaVersion:SCHEMA_VERSION,...identity,season:records.at(-1)?.season??null,week:records.at(-1)?.week??null,classification,discoveryClassification:classification,signalStrength:strength,timing,timingPosture:timing,confidence:clamp(confidence),roleTrend:role.status.replace('ROLE_',''),opportunityTrend:opportunity.status.replace('OPPORTUNITY_',''),productionSupport:production.status,persistence:sample,sampleQuality:sample,freshness:fresh,seasonIdentityType:identity.identityType,isSeasonOnlyIdentity:identity.identityType==='SEASON_ONLY',sourceEvidenceIds:sourceIds(records),provenanceSummary:freeze([...new Set(records.map(record=>`${record.provenance.source} • ${record.provenance.provider}`).filter(Boolean))]),evidenceChips:freeze([role.status.replace('ROLE_','Role '),opportunity.status.replace('OPPORTUNITY_','Opportunity '),`${weekly.length} weekly sample${weekly.length===1?'':'s'}`,fresh].filter(Boolean)),latestUsage:freeze({offensiveSnaps:latestNumber(records,'role.offensiveSnaps'),offensiveSnapShare:latestNumber(records,'role.offensiveSnapShare'),snapShare:latestNumber(records,'role.snapShare'),routesRun:latestNumber(records,'role.routesRun'),routeParticipation:latestNumber(records,'role.routeParticipation'),routes:latestNumber(records,'role.routes'),targets:latestNumber(records,'opportunity.targets'),targetShare:latestNumber(records,'opportunity.targetShare'),carries:latestNumber(records,'opportunity.carries'),touches:latestNumber(records,'opportunity.touches'),opportunities:latestNumber(records,'opportunity.opportunities')}),recommendationAuthority:false,transactionAuthority:false,sharingan:false,chidori:false});
      this.coreCache.set(cacheKey,core);return core;
    }
    evaluate(playerOrId,context={}){
      const id=typeof playerOrId==='string'?playerOrId:playerId(playerOrId),player=typeof playerOrId==='string'?this._registryPlayer(id)||{canonicalPlayerId:id}:playerOrId,core=this._core(player),yahooKnown=context.yahooAuthoritative===true&&['AVAILABLE','ROSTERED','ROSTERED_BY_USER','ROSTERED_BY_OTHER','WAIVER','FREE_AGENT'].includes(upper(context.yahooAvailabilityState)),waiver=context.waiverDecision||null,transactionAuthority=Boolean(yahooKnown&&waiver?.authority==='LIVE'&&waiver?.action==='ACT'&&['AVAILABLE','WAIVER','FREE_AGENT'].includes(upper(context.yahooAvailabilityState))),teamFit=context.teamFit||null,injury=this.injuryEngine?.evaluate?.(player,{phase:context.phase||'DISCOVERY'})||null,injuryRequiresWait=injury&&(upper(injury.freshness)==='STALE'||upper(injury.timingState)==='WAIT'&&upper(injury.primarySignal)!=='NO_MATERIAL_SIGNAL'),effectiveTiming=injuryRequiresWait&&core.timing==='ACT'?'WAIT':core.timing,result={...core,timing:effectiveTiming,yahooAvailabilityState:yahooKnown?upper(context.yahooAvailabilityState):'UNKNOWN',yahooAvailabilityAuthoritative:yahooKnown,transactionAuthority,transactionDecision:transactionAuthority?'REFER_TO_WAIVER_ENGINE':'NONE',teamFitContext:teamFit?freeze({status:teamFit.status||'UNKNOWN',reason:teamFit.reason||null}):freeze({status:'UNKNOWN',reason:'TeamFit context is unavailable.'}),scoringContext:context.scoringFormat?freeze({format:context.scoringFormat,relevance:'CONTEXT_ONLY'}):freeze({format:'UNKNOWN',relevance:'CONTEXT_ONLY'}),injuryOpportunityContext:injury?freeze({primarySignal:injury.primarySignal,timingState:injury.timingState,freshness:injury.freshness||'UNKNOWN',authority:'CONTEXT_ONLY'}):freeze({primarySignal:'UNKNOWN',timingState:'WAIT',freshness:'UNKNOWN',authority:'CONTEXT_ONLY'}),newlyDiscovered:core.identityType==='SEASON_ONLY',discoveryBadge:core.identityType==='SEASON_ONLY'?'NEW SEASON IDENTITY':null};
      Object.assign(result,synthesis(result));result.discoveryClassification=result.classification;result.timingPosture=result.timing;result.primaryReason=result.whatChanged;result.supportingReasons=freeze([result.whyItMatters,result.whatToDo]);result.riskFlags=freeze([result.riskSummary]);return freeze(result);
    }
    evaluateAll(players=[],contextForPlayer={}){
      const values=[...players].map(player=>{const id=typeof player==='string'?player:playerId(player),context=typeof contextForPlayer==='function'?contextForPlayer(id,player):contextForPlayer;return this.evaluate(player,context)});
      return freeze(values.sort((a,b)=>PRIORITY[b.classification]-PRIORITY[a.classification]||['STRONG','DEVELOPING','WEAK','NONE'].indexOf(a.signalStrength)-['STRONG','DEVELOPING','WEAK','NONE'].indexOf(b.signalStrength)||b.confidence-a.confidence||a.playerName.localeCompare(b.playerName)));
    }
    buildView(results=[]){const available=results.filter(result=>result.classification!=='INSUFFICIENT_EVIDENCE'),topSignals=available.filter(result=>['BREAKOUT','ROLE_GROWTH'].includes(result.classification)).slice(0,3),emerging=available.filter(result=>['EMERGING','OPPORTUNITY_WATCH'].includes(result.classification)).slice(0,5),watchlist=available.filter(result=>['STASH_WATCH','STABLE'].includes(result.classification)).slice(0,5),fadingNoise=available.filter(result=>['FADING','NOISE'].includes(result.classification));return freeze({schemaVersion:SCHEMA_VERSION,topSignals:freeze(topSignals),emerging:freeze(emerging),watchlist:freeze(watchlist),fadingNoise:freeze(fadingNoise),insufficientEvidence:results.filter(result=>result.classification==='INSUFFICIENT_EVIDENCE').length,total:results.length,recommendationAuthority:false,transactionAuthority:false})}
  }
  return freeze({SCHEMA_VERSION,CLASSIFICATIONS,STRENGTHS,TIMING,DiscoveryBreakoutRadarV1});
});
