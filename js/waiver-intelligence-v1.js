(function(root,factory){'use strict';const transaction=root.FantasyHQWaiverTransactionQualityV1||(typeof module!=='undefined'&&module.exports?require('./waiver-transaction-quality-v1.js'):null),api=factory(transaction);if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FantasyHQWaiverIntelligence=api;})(typeof window!=='undefined'?window:globalThis,function(TransactionQuality){
  'use strict';
  const ACTION=Object.freeze({ACT:'ACT',WAIT:'WAIT',HOLD:'HOLD'});
  const NEED=Object.freeze({CRITICAL:4,HIGH:3,MODERATE:2,LOW:1,NONE:0});
  const DROP=Object.freeze({PROTECTED:'PROTECTED',RELUCTANT_DROP:'RELUCTANT_DROP',DROPPABLE:'DROPPABLE',PRIORITY_DROP:'PRIORITY_DROP'});
  const TIERS=Object.freeze(['MUST CONSIDER','TARGET','WATCH','STASH','PASS']);
  const clean=value=>String(value??'').trim();
  const finite=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
  const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
  const position=value=>{const p=clean(value).toUpperCase().replace(/[^A-Z]/g,'');return p==='DEF'||p==='DST'||p==='DEFENSE'?'DST':p;};
  const identityId=player=>clean(player?.identity?.canonicalPlayerId||player?.canonicalPlayerId||player?.playerId||player?.id);
  const identityStatus=player=>clean(player?.identity?.status||player?.identityStatus).toUpperCase();
  const evidenceOf=player=>player?.waiverEvidence||player?.seasonEvidence||player?.raw?.waiverEvidence||{};
  const starterSlot=value=>{const raw=clean(typeof value==='object'?value.position:value).toUpperCase().replace(/[^A-Z0-9/]/g,''),base=raw.replace(/\d+$/,'');if(base==='DEF'||base==='D/ST')return'DST';if(base==='BENCH')return'BN';return base;};
  function configuredSlots(model,profile){const source=model?.snapshot?.settings?.rosterSlots||profile?.settings?.rosterSlots||[];if(Array.isArray(source)&&source.length)return source.flatMap(value=>{if(value&&typeof value==='object'){const count=Math.max(1,Number(value.count)||1);return Array.from({length:count},()=>starterSlot(value));}return[starterSlot(value)]});const settings=profile?.settings||{};return[['QB',settings.startQB],['RB',settings.startRB],['WR',settings.startWR],['TE',settings.startTE],['FLEX',settings.flex],['K',settings.startK],['DST',settings.startDST],['BN',settings.bench],['IR',settings.irSlots]].flatMap(([slot,count])=>Array.from({length:Math.max(0,Number(count)||0)},()=>slot));}
  function trustworthy(model){
    if(!model?.snapshot)return{ok:false,code:'INSUFFICIENT_VALIDATED_SEASON_DATA',reason:'Season snapshot unavailable.'};
    const manual=model?.manualAuthority?.source==='USER_CONFIRMED'&&model?.manualAuthority?.complete===true;
    if(model.draftSnapshot&&!manual)return{ok:false,code:'INSUFFICIENT_VALIDATED_SEASON_DATA',reason:'Waiver intelligence awaiting current Yahoo roster and availability data.'};
    const yahoo=clean(model.snapshot.provider).toLowerCase()==='yahoo',demo=model.demo===true;
    if(!yahoo&&!demo&&!manual)return{ok:false,code:'INSUFFICIENT_VALIDATED_SEASON_DATA',reason:'Current ownership and availability are not trustworthy.'};
    if(!demo&&!manual&&(model.stale||!model.snapshot?.datasets?.players||clean(model.snapshot.datasets.players.status).toUpperCase()!=='CURRENT'))return{ok:false,code:'INSUFFICIENT_VALIDATED_SEASON_DATA',reason:'Current Yahoo availability is stale or unknown.'};
    if(model.userTeamResolution?.status!=='RESOLVED'||!model.snapshot?.ownership?.valid)return{ok:false,code:'INSUFFICIENT_VALIDATED_SEASON_DATA',reason:'Roster ownership is unresolved or ambiguous.'};
    return{ok:true,code:'VALIDATED',reason:null,mode:demo?'DEMO':manual?'USER_CONFIRMED':'YAHOO'};
  }
  function assessRosterNeed(model,profile){
    const slots=configuredSlots(model,profile),required={QB:0,RB:0,WR:0,TE:0,K:0,DST:0},flexCount=slots.filter(slot=>slot==='FLEX'||slot==='W/R/T').length;
    slots.forEach(slot=>{if(Object.prototype.hasOwnProperty.call(required,slot))required[slot]+=1});
    const roster=model?.roster||[],counts={QB:0,RB:0,WR:0,TE:0,K:0,DST:0},bench={QB:0,RB:0,WR:0,TE:0,K:0,DST:0},ir={QB:0,RB:0,WR:0,TE:0,K:0,DST:0};
    roster.forEach(player=>{const pos=position(player.position),slot=starterSlot(player.rosterSlot);if(!Object.prototype.hasOwnProperty.call(counts,pos))return;counts[pos]+=1;if(slot==='BN')bench[pos]+=1;if(slot==='IR')ir[pos]+=1});
    const needs={};Object.keys(required).forEach(pos=>{const healthy=Math.max(0,counts[pos]-ir[pos]),base=required[pos];let level='NONE';if(healthy<base)level='CRITICAL';else if(healthy===base&&base>0)level='HIGH';else if(healthy<=base+1)level='MODERATE';else if(healthy<=base+2)level='LOW';needs[pos]={position:pos,level,score:NEED[level],required:base,rostered:counts[pos],healthy,bench:bench[pos],ir:ir[pos],flexEligible:['RB','WR','TE'].includes(pos)&&flexCount>0,byeCoverage:'UNKNOWN',injuryContext:ir[pos]?'KNOWN_IR_SLOT':'NO_IR_SLOT_FLAG'}});
    return Object.freeze({slots:Object.freeze(slots),flexCount,needs:Object.freeze(needs)});
  }
  function evidenceNumber(evidence,key){const value=finite(evidence?.[key]);return value===null?null:clamp(value);}
  function evidenceConfidence(evidence){const direct=finite(evidence?.confidence);if(direct!==null)return clamp(direct)/100;const keys=['sourceValue','role','opportunity','upside','risk'],known=keys.filter(key=>evidenceNumber(evidence,key)!==null).length;return known/keys.length;}
  function provenance(evidence,player){return Object.freeze({availabilitySource:clean(evidence.availabilitySource||player?.availabilitySource||'Yahoo')||null,identitySource:clean(evidence.identitySource||player?.identity?.reason)||null,rankingSource:clean(evidence.rankingSource)||null,injurySource:clean(evidence.injurySource)||null,roleSource:clean(evidence.roleSource)||null,opportunitySource:clean(evidence.opportunitySource)||null,fetchedAt:clean(evidence.fetchedAt)||null});}
  function evaluateDrop(player,need){
    const evidence=evidenceOf(player),slot=starterSlot(player.rosterSlot),starter=!['BN','IR'].includes(slot),value=evidenceNumber(evidence,'sourceValue'),upside=evidenceNumber(evidence,'upside'),role=evidenceNumber(evidence,'role'),replaceability=evidenceNumber(evidence,'replaceability'),pos=position(player.position),posContext=need?.needs?.[pos]||{},posNeed=posContext.level||'NONE',insurance=evidenceNumber(evidence,'insuranceValue'),roleTrend=evidenceNumber(evidence,'roleTrend'),oneStarter=['QB','TE','K','DST'].includes(pos)&&posContext.required===1,redundant=oneStarter&&posContext.rostered>1&&posContext.bench>0,confidence=evidenceConfidence(evidence);
    let state=DROP.RELUCTANT_DROP,dropCost=58,reasons=[];
    if(starter){state=DROP.PROTECTED;dropCost=100;reasons.push('Current starter relevance');}
    else if(posNeed==='CRITICAL'||(insurance!==null&&insurance>=75&&upside!==null&&upside>=60)){state=DROP.PROTECTED;dropCost=92;reasons.push('Scarce roster depth or validated insurance value');}
    else if((value!==null&&value>=80&&!(roleTrend!==null&&roleTrend<=30))||(upside!==null&&upside>=78&&confidence>=.75)){state=DROP.PROTECTED;dropCost=92;reasons.push('Validated value or upside');}
    else if(value===null||upside===null||role===null){state=DROP.RELUCTANT_DROP;dropCost=68;reasons.push('Drop evidence incomplete');}
    else if(redundant&&replaceability!==null&&replaceability>=55&&insurance!==null&&insurance<60){state=DROP.DROPPABLE;dropCost=clamp(34-(replaceability-55)*.2+(value-50)*.12,18,44);reasons.push(`Redundant ${pos} depth in a one-starter format`);}
    else if(value<=28&&upside<=32&&role<=30&&(replaceability===null||replaceability>=65)){state=DROP.PRIORITY_DROP;dropCost=12;reasons.push('Low value, role, and bench upside');}
    else if(value<=48&&upside<=55&&role<=50){state=DROP.DROPPABLE;dropCost=30;reasons.push('Replaceable bench profile');}
    else{reasons.push('Bench utility remains meaningful');}
    const redundancyCredit=redundant?Math.min(32,Math.max(8,(replaceability??55)-40)):0,optionalityCost=clamp((upside??50)*.45+(insurance??35)*.35+(100-(replaceability??50))*.20);
    return Object.freeze({player,canonicalPlayerId:identityId(player),state,dropCost,reasons:Object.freeze(reasons),confidence,evidenceComplete:value!==null&&upside!==null&&role!==null,context:Object.freeze({position:pos,redundant,oneStarter,insuranceValue:insurance,roleTrend,replaceability}),redundancyCredit,optionalityCost,provenance:provenance(evidence,player)});
  }
  function candidateTier(score){return score>=85?TIERS[0]:score>=72?TIERS[1]:score>=58?TIERS[2]:score>=48?TIERS[3]:TIERS[4];}
  function estimateCompetition(player,model,profile){
    const teams=Array.isArray(model?.teams)?model.teams:[],pos=position(player?.position),slots=configuredSlots(model,profile),required=slots.filter(slot=>slot===pos).length;
    if(teams.length<2||!required)return Object.freeze({status:'UNKNOWN',starterNeedCount:null,depthDemandCount:null,comparableAlternativeCount:null,reason:'Trustworthy all-team roster context is unavailable.'});
    let starterNeedCount=0,depthDemandCount=0;
    teams.forEach(team=>{const roster=Array.isArray(team?.roster)?team.roster:[],count=roster.filter(item=>position(item?.position)===pos).length;if(count<required)starterNeedCount+=1;else if(count===required)depthDemandCount+=1;});
    const candidateId=identityId(player),comparableAlternativeCount=(model.available||[]).filter(item=>identityId(item)!==candidateId&&position(item?.position)===pos&&['FREE AGENT','FREE_AGENT','FA','WAIVER','WAIVERS','W'].includes(clean(item.availability||item.ownership).toUpperCase())).length;
    return Object.freeze({status:'OBSERVED',starterNeedCount,depthDemandCount,comparableAlternativeCount,reason:starterNeedCount?`${starterNeedCount} team${starterNeedCount===1?'':'s'} have an unfilled ${pos} starter requirement; ${comparableAlternativeCount} comparable alternative${comparableAlternativeCount===1?' is':'s are'} available.`:depthDemandCount?`No starter vacancy is observed; ${depthDemandCount} team${depthDemandCount===1?'':'s'} may still seek ${pos} depth, with ${comparableAlternativeCount} comparable alternative${comparableAlternativeCount===1?'':'s'}.`:`No immediate ${pos} roster demand is visible; ${comparableAlternativeCount} comparable alternative${comparableAlternativeCount===1?' is':'s are'} available.`});
  }
  function faabContract(model){return Object.freeze({status:'NOT_SCORED',label:'FAAB: Not yet scored',startingBudget:finite(model?.snapshot?.settings?.faabBudget),remainingBudget:finite(model?.userTeam?.faabRemaining),week:finite(model?.week),inputs:Object.freeze({playerQuality:'PER_CANDIDATE',rosterNeed:'AVAILABLE',expectedCompetition:'AVAILABLE_WHEN_ALL_TEAM_ROSTERS_ARE_CURRENT',positionalScarcity:'AVAILABLE',replacementAvailability:'AVAILABLE',urgency:'AVAILABLE'}),output:null});}
  function evaluateCandidate(player,need,phase){
    const evidence=evidenceOf(player),id=identityId(player),status=identityStatus(player),availabilityState=clean(player?.availabilityState?.status),availability=clean(availabilityState||player.availability||player.ownership).toUpperCase(),pos=position(player.position),posNeed=need?.needs?.[pos]||{level:'NONE',score:0},sourceValue=evidenceNumber(evidence,'sourceValue'),role=evidenceNumber(evidence,'role'),opportunity=evidenceNumber(evidence,'opportunity'),upside=evidenceNumber(evidence,'upside'),risk=evidenceNumber(evidence,'risk'),acquisitionCost=evidenceNumber(evidence,'acquisitionCost'),confidence=evidenceConfidence(evidence),validIdentity=Boolean(id&&['MATCHED','ALIAS_MATCH','ARCHIVE_RECORDED'].includes(status)),validAvailability=['AVAILABLE','FREE AGENT','FREE_AGENT','FA','WAIVER','WAIVERS','W'].includes(availability)&&player?.availabilityState?.actionable!==false,known=[sourceValue,role,opportunity,upside,risk].filter(value=>value!==null).length;
    if(!validIdentity||!validAvailability)return Object.freeze({player,canonicalPlayerId:id||null,action:ACTION.HOLD,tier:'PASS',eligible:false,reason:'INSUFFICIENT_VALIDATED_SEASON_DATA',confidence,provenance:provenance(evidence,player)});
    if(sourceValue===null)return Object.freeze({player,canonicalPlayerId:id,action:ACTION.HOLD,tier:'PASS',eligible:false,reason:'Source value is unknown.',confidence,provenance:provenance(evidence,player)});
    const rosterFit=posNeed.score*6.25,roleValue=role??45,opportunityValue=opportunity??45,upsideValue=upside??45,riskValue=risk??50,costValue=acquisitionCost??50,ce=evidenceNumber(evidence,'championshipEquity'),ceAdditive=ce===null?0:Math.min(3,Math.max(0,(ce-50)/16.67)),score=clamp(sourceValue*.34+roleValue*.20+opportunityValue*.16+upsideValue*.14+rosterFit*.16-riskValue*.10-costValue*.08+ceAdditive),complete=known===5&&acquisitionCost!==null&&confidence>=.7;
    let action=ACTION.HOLD;if(score>=48&&!complete)action=ACTION.WAIT;else if(score>=72&&complete)action=ACTION.ACT;else if(score>=48||(score>=40&&upsideValue>=80&&confidence>=.7))action=ACTION.WAIT;
    if(phase==='discovery'&&action===ACTION.ACT&&(score<72||confidence<.85))action=ACTION.WAIT;
    return Object.freeze({player,canonicalPlayerId:id,position:pos,action,tier:candidateTier(score),eligible:true,score,confidence,complete,rosterNeed:posNeed.level,rosterFit,dimensions:Object.freeze({sourceValue,role,opportunity,upside,risk,acquisitionCost,championshipEquity:ce,championshipEquityAdditive:ceAdditive}),roleFit:role===null?'UNKNOWN':role>=70?'POSITIVE':'LIMITED',starterPath:clean(evidence.starterPath)||'UNKNOWN',benchUtility:clean(evidence.benchUtility)||'UNKNOWN',byeCoverage:'UNKNOWN',injuryInsurance:clean(evidence.injuryInsurance)||'UNKNOWN',flexUtility:posNeed.flexEligible?'ELIGIBLE':'NOT_APPLICABLE',provenance:provenance(evidence,player)});
  }
  function pairCandidates(candidates,drops,phase,contextByPlayer={}){
    const acceptable=drops.filter(drop=>[DROP.DROPPABLE,DROP.PRIORITY_DROP].includes(drop.state)||(drop.state===DROP.RELUCTANT_DROP&&drop.evidenceComplete)).sort((a,b)=>a.dropCost-b.dropCost||a.canonicalPlayerId.localeCompare(b.canonicalPlayerId));
    return candidates.map(candidate=>{
      if(!candidate.eligible)return Object.freeze({...candidate,drop:null,alternativeDrop:null,comparedDrops:Object.freeze([]),netGain:null,transaction:null,action:ACTION.HOLD});
      if(!acceptable.length)return Object.freeze({...candidate,drop:null,alternativeDrop:null,comparedDrops:Object.freeze([]),netGain:null,transaction:null,action:ACTION.HOLD,reason:'No acceptable drop candidate clears protection.'});
      const context=contextByPlayer[candidate.canonicalPlayerId]||{},comparisons=acceptable.map(drop=>Object.freeze({drop,transaction:TransactionQuality.evaluate({candidate,drop,phase,context})})).sort((a,b)=>(b.transaction.netTransactionValue??-999)-(a.transaction.netTransactionValue??-999)||a.drop.canonicalPlayerId.localeCompare(b.drop.canonicalPlayerId)),best=comparisons[0],alternative=comparisons[1]||null;
      return Object.freeze({...candidate,drop:best.drop,alternativeDrop:alternative?.drop||null,comparedDrops:Object.freeze(comparisons),netGain:best.transaction.netTransactionValue,transaction:best.transaction,action:best.transaction.action,archetype:best.transaction.archetype,reason:best.transaction.reason,rosterConsequence:Object.freeze({action:'ADD_DROP',addPlayerId:candidate.canonicalPlayerId,addPlayerName:candidate.player?.name||null,dropPlayerId:best.drop.canonicalPlayerId,dropPlayerName:best.drop.player?.name||null})});
    }).sort((a,b)=>(b.netGain??-999)-(a.netGain??-999)||b.score-a.score||clean(a.canonicalPlayerId).localeCompare(clean(b.canonicalPlayerId)));
  }
  function insufficientResult(reason,model,need,candidates=[],drops=[]){return Object.freeze({status:'INSUFFICIENT_VALIDATED_SEASON_DATA',action:ACTION.HOLD,timing:Object.freeze({action:ACTION.HOLD,headline:'WAIVER DATA NEEDED',reason}),reason,need,candidates:Object.freeze(candidates),drops:Object.freeze(drops),pairs:Object.freeze([]),signals:Object.freeze({sharinganPick:null,sharinganWatch:null,sharinganHold:true,chidori:null}),faab:faabContract(model),provenance:Object.freeze({seasonSource:model?.sourceLabel||null,profileId:model?.profileId||null})});}
  const PROTECTION=Object.freeze({PROTECTED:'PROTECTED',UNRESOLVED:'UNRESOLVED',REMOVABLE:'REMOVABLE'});
  function transactionProtection({player,candidate,model,profile,now=Date.now()}={}){
    const reasons=[], missing=['Affirmative evidence resolving future removal consequence'];
    const id=identityId(player),slot=starterSlot(player?.rosterSlot),e=player?.currentWeek;
    const fresh=(stamp,max)=>{const age=now-Date.parse(stamp||'');return Number.isFinite(age)&&age>=0&&age<=max;};
    const result=state=>({state,reasons,missingEvidence:missing,longTermDropValue:'UNKNOWN',removalAuthorized:false,
      // No existing production source supplies affirmative removal authority.
      removableContract:{status:'UNSUPPORTED_BY_EXISTING_SOURCES',requires:'Affirmative, current, identity/profile/transaction-bound evidence that material future removal cost is resolved; structural legality alone is insufficient.'}});
    if(!id||!e?.identity?.safe||e.identity.canonicalPlayerId!==id||!['MATCHED','ALIAS_MATCH','ARCHIVE_RECORDED'].includes(identityStatus(player))||
      (player.canonicalPlayerId&&player.canonicalPlayerId!==id)||!fresh(model?.snapshot?.fetchedAt,30*60000)){
      reasons.push('Identity or current Yahoo authority is unresolved.');return result(PROTECTION.UNRESOLVED);
    }
    if(slot==='IR'){reasons.push('Current Yahoo IR assignment protects the roster player.');}
    else if(slot&&slot!=='BN'){reasons.push('Active starter assignment protects the roster player.');}
    if(e.game?.locked||player.locked||['LIVE','FINAL','LOCKED_UNKNOWN'].includes(e.game?.state)||Date.parse(e.game?.kickoff||'')<=now)reasons.push('Game lock prevents removal.');
    if([e.injury?.status,e.injury?.rawStatus,player.injuryStatus].some(v=>['IR','OUT','O','PUP','NFI'].includes(clean(v).toUpperCase())))reasons.push('Explicit injury/reserve status requires protection, not a discard assumption.');
    const slots=configuredSlots(model,profile),pos=position(player.position),remaining=(model?.roster||[]).filter(p=>identityId(p)!==id&&position(p.position)===pos&&starterSlot(p.rosterSlot)!=='IR');
    const required=slots.filter(s=>s===pos).length;
    if(slots.length&&remaining.length<required)reasons.push('Removing this player would lose required positional coverage before replacement.');
    if(e.projection?.supported&&finite(e.projection.value)>0&&fresh(e.projection.fetchedAt,24*3600000))reasons.push('Supported positive current-week usefulness remains on the roster.');
    const observed=(player.currentWeekWaiverUsage||[]).filter(r=>r.canonicalPlayerId===id&&Number(r.season)===Number(model?.snapshot?.league?.season)&&Number(r.week)>0&&Number(r.week)<Number(model?.week)&&r.provenance?.source&&r.provenance?.provider&&fresh(r.observedAt,16*86400000));
    if(observed.some(r=>[r.role?.offensiveSnaps,r.role?.offensiveSnapShare,r.role?.snapShare,r.opportunity?.carries,r.opportunity?.targets,r.opportunity?.opportunities].some(v=>finite(v)>0)))reasons.push('Observed recent participation/opportunity is affirmative protection evidence.');
    if(observed.some(r=>r.relationship?.validated===true&&r.relationship.relatedCanonicalPlayerId))reasons.push('Explicit sourced player relationship requires preserving its unresolved opportunity value.');
    if(!reasons.length)reasons.push('Bench assignment, low/zero projection and missing evidence do not establish safe removal.');
    const protectedEvidence=reasons.length&& !reasons[0].startsWith('Bench assignment');
    const output=result(protectedEvidence?PROTECTION.PROTECTED:PROTECTION.UNRESOLVED);
    output.structure={position:pos,requiredStarters:slots.length?required:null,depthAfterDrop:remaining.length,
      depthAfterReplacement:remaining.length+(candidate&&position(candidate.position)===pos?1:0),
      injuryUnknown:remaining.filter(p=>!p.currentWeek?.injury?.status||p.currentWeek.injury.status==='UNKNOWN').length,
      byeWeek:player.byeWeek??null,candidateByeWeek:candidate?.byeWeek??null};
    return output;
  }
  function currentWeekTransaction({candidate,rosterPlayer,model,profile,now,difference}={}){
    const protection=transactionProtection({player:rosterPlayer,candidate,model,profile,now});
    const eligibility=(rosterPlayer.eligiblePositions||[]).filter(p=>!['BN','IR'].includes(p));
    const legalStructure=starterSlot(rosterPlayer.rosterSlot)==='BN'&&position(candidate.position)===position(rosterPlayer.position)&&eligibility.length>0&&eligibility.every(p=>(candidate.eligiblePositions||[]).includes(p))&&configuredSlots(model,profile).length>0;
    const missing=[...protection.missingEvidence,...(!legalStructure?['Confirmed roster construction preserving eligibility']:[])];
    // No additive quality, drop-cost score or unverified REMOVABLE input is accepted.
    return {protection,legalStructure,missingEvidence:missing,addAuthorized:false,action:difference>0?'WATCH':'HOLD',
      reason:difference>0?`Supported weekly projection is higher, but removal is ${protection.state}: ${protection.reasons.join(' ')} Future removal consequence remains unresolved. WATCH means monitor, not add.`:'Supported weekly projection does not establish an improvement over this bench player. HOLD applies only to this current-week comparison.'};
  }
  // Weekly evidence is a comparison, never a rated acquisition/drop decision.
  function evaluateCurrentWeek({model,profile,now=Date.now()}={}){
    const snapshot=model?.snapshot, comparisons=[], rejected=[];
    const base={horizon:'CURRENT_WEEK',context:{profileId:model?.profileId||null,leagueKey:snapshot?.league?.leagueKey||null,teamKey:snapshot?.userTeamKey||null,season:snapshot?.league?.season||null,week:model?.week||null,yahooFetchedAt:snapshot?.fetchedAt||null},pairs:[],longTermDropValue:'UNKNOWN',faab:{authority:'BLOCKED',output:null,reason:'Permanent drop valuation unavailable.'}};
    const insufficient=reason=>({...base,status:'INSUFFICIENT_EVIDENCE',action:'INSUFFICIENT_EVIDENCE',reason,comparisons,rejected});
    const ageOk=(stamp,max)=>{const age=now-Date.parse(stamp||'');return Number.isFinite(age)&&age>=0&&age<=max;};
    if(!trustworthy(model).ok||snapshot?.provider!=='Yahoo'||model.demo||model.draftSnapshot||
      !profile?.id||profile.id!==model.profileId||snapshot.profileId!==profile.id||
      !snapshot.league?.leagueKey||!snapshot.league?.season||Number(snapshot.league.currentWeek)!==Number(model.week)||
      !snapshot.userTeamKey||snapshot.userTeamKey!==model.userTeamResolution?.teamKey||
      !ageOk(snapshot.fetchedAt,30*60000))return insufficient('Current selected Yahoo profile, league, team, week and availability are required.');
    const ownership=snapshot.ownership.ownership||{}, roster=snapshot.currentRoster;
    const format=value=>{const v=clean(value).toUpperCase().replace(/[^A-Z0-9]/g,'');return v.includes('HALF')?'HALF_PPR':v.includes('FULL')||v==='PPR'?'FULL_PPR':v.includes('STANDARD')||v.includes('NONPPR')?'STANDARD':v;};
    const usage=player=>{
      const rows=(player.currentWeekWaiverUsage||[]).filter(row=>row.canonicalPlayerId===identityId(player)&&Number(row.season)===Number(snapshot.league.season)&&Number(row.week)>0&&Number(row.week)<Number(model.week)&&row.provenance?.provider&&row.provenance?.source&&ageOk(row.observedAt,16*86400000));
      return rows.length?rows:null;
    };
    if(roster?.yahooTeamKey!==snapshot.userTeamKey||roster?.yahooLeagueKey!==snapshot.league.leagueKey)return insufficient('Current Yahoo roster membership is unavailable.');
    const validate=(player,isCandidate)=>{
      const id=identityId(player),e=player.currentWeek,p=e?.projection,owner=ownership[id];
      if(!id||!['MATCHED','ALIAS_MATCH','ARCHIVE_RECORDED'].includes(identityStatus(player))||
        !player.yahooPlayerId||player.sourcePlayerKey!==`${snapshot.league.leagueKey.split('.')[0]}.p.${player.yahooPlayerId}`||!e?.identity?.safe||e.identity.canonicalPlayerId!==id||
        (player.canonicalPlayerId&&player.canonicalPlayerId!==id)||
        (player.projectionCanonicalPlayerId&&player.projectionCanonicalPlayerId!==id)||
        !owner||String(owner.sourcePlayerId)!==String(player.yahooPlayerId))return 'Identity unresolved or conflicting.';
      if(isCandidate){
        if(owner.teamKey||!['FREE_AGENT','WAIVERS'].includes(owner.status)||player.availabilityState?.actionable!==true||
          (snapshot.teams||[]).some(t=>(t.roster||[]).some(r=>identityId(r)===id||String(r.yahooPlayerId)===String(player.yahooPlayerId))))return 'Yahoo does not confirm availability.';
        if(!(snapshot.availablePlayers||[]).some(r=>identityId(r)===id&&r.sourcePlayerKey===player.sourcePlayerKey))return 'Player absent from current Yahoo available pool.';
      }else if(owner.status!=='ROSTERED_BY_USER'||owner.teamKey!==snapshot.userTeamKey||starterSlot(player.rosterSlot)!=='BN'||
        !(roster.roster||[]).some(r=>r.canonicalPlayerId===id&&String(r.yahooPlayerId)===String(player.yahooPlayerId)&&r.yahooPlayerKey===player.sourcePlayerKey&&starterSlot(r.rosterSlot)==='BN'))return 'Eligible current Yahoo bench membership unavailable.';
      if(!player.eligiblePositions?.length||Number(e.season)!==Number(snapshot.league.season)||Number(e.week)!==Number(model.week))return 'Eligibility or current season/week unresolved.';
      if(!p?.supported||finite(p.value)===null||Number(p.week)!==Number(model.week)||!p.source||!p.scoringFormat||
        !['CURRENT','AGING'].includes(p.freshness)||!ageOk(p.fetchedAt,24*3600000)||player.projectionProvenance?.recommendationAuthority===false)return 'Compatible fresh weekly projection unavailable.';
      const provenance=player.projectionProvenance;
      if(provenance&&((provenance.canonicalPlayerId&&provenance.canonicalPlayerId!==id)||Number(provenance.season)!==Number(snapshot.league.season)||Number(provenance.week)!==Number(model.week)))return 'Projection provenance conflicts with identity or season/week.';
      const estimate=p.projectionType==='SLEEPER_HALF_PPR_ESTIMATE';
      if(estimate ? p.scoringFormat!=='HALF_PPR' : format(p.scoringFormat)!==format(model.scoring))return 'Projection scoring basis is incompatible.';
      if(p.projectionType==='CUSTOM_SCORING'&&provenance?.scoringCompatibility?.status!=='EXACT')return 'Exact league scoring compatibility unavailable.';
      const g=e.game;
      if(g?.state!=='PRE_GAME'||g.actionable!==true||g.locked||!ageOk(g.updatedAt,60*60000)||
        !Number.isFinite(Date.parse(g.kickoff||''))||Date.parse(g.kickoff)<=now)return 'Current game/action legality unavailable or locked.';
      if([e.injury?.status,e.injury?.rawStatus,player.injuryStatus].some(v=>['OUT','IR','O','INJURED_RESERVE'].includes(clean(v).toUpperCase())))return 'Out/IR injury evidence prevents weekly comparison.';
      return null;
    };
    const candidates=(model.available||[]).filter(p=>{const reason=validate(p,true);if(reason)rejected.push({name:p.name,reason});return !reason;});
    const bench=(model.roster||[]).filter(p=>{const reason=validate(p,false);return !reason;});
    const protections=(model.roster||[]).map(player=>({canonicalPlayerId:identityId(player),name:player.name,...transactionProtection({player,model,profile,now})}));
    for(const candidate of candidates)for(const rosterPlayer of bench){
      // Same football position prevents shared BN/FLEX labels from creating false substitutes.
      if(position(candidate.position)!==position(rosterPlayer.position)||!candidate.eligiblePositions.some(v=>rosterPlayer.eligiblePositions.includes(v)&&!['BN','IR'].includes(v)))continue;
      const c=candidate.currentWeek,r=rosterPlayer.currentWeek;
      if(c.projection.scoringFormat!==r.projection.scoringFormat||c.projection.source!==r.projection.source||c.projection.projectionType!==r.projection.projectionType)continue;
      const difference=Math.round((c.projection.value-r.projection.value)*100)/100,action=difference>0?'WATCH':'HOLD',candidateUsage=usage(candidate),rosterUsage=usage(rosterPlayer);
      const transaction=currentWeekTransaction({candidate,rosterPlayer,model,profile,now,difference});
      comparisons.push({transaction,transactionProtection:transaction.protection,horizon:'CURRENT_WEEK',candidate,rosterPlayer,yahooStatus:ownership[identityId(candidate)].status,
        candidateProjection:{...c.projection,provenance:candidate.projectionProvenance||null},rosterProjection:{...r.projection,provenance:rosterPlayer.projectionProvenance||null},difference,
        injury:{candidate:c.injury||{status:'UNKNOWN'},roster:r.injury||{status:'UNKNOWN'}},optionalEvidence:candidateUsage||rosterUsage?{candidate:candidateUsage,roster:rosterUsage}:null,
        missingEvidence:[...(!candidateUsage?['Candidate observed usage with dated provenance']:[]),...(!rosterUsage?['Roster observed usage with dated provenance']:[]),...transaction.missingEvidence],longTermDropValue:'UNKNOWN',action,
        reason:transaction.reason,
        faab:{authority:'BLOCKED',output:null}});
    }
    comparisons.sort((a,b)=>b.difference-a.difference||a.candidate.name.localeCompare(b.candidate.name)||a.rosterPlayer.name.localeCompare(b.rosterPlayer.name));
    if(!comparisons.length)return insufficient('No same-position candidate/bench pair has current Yahoo authority, legal game state and compatible weekly projections.');
    return {...base,status:'EVALUATED',action:comparisons[0].action,reason:comparisons[0].reason,comparisons,rejected,protections};
  }
  function evaluate({model,profile,contextByPlayer={},horizon,now}={}){
    if(horizon==='CURRENT_WEEK')return evaluateCurrentWeek({model,profile,now});
    const gate=trustworthy(model),phase=model?.phase?.key||'discovery',need=assessRosterNeed(model||{},profile||{});
    if(!gate.ok)return insufficientResult(gate.reason,model,need);
    if(!need.slots.length||!Array.isArray(model.roster)||!model.roster.length)return insufficientResult('Roster state or league starting requirements are incomplete.',model,need);
    const drops=(model.roster||[]).map(player=>evaluateDrop(player,need)),candidates=(model.available||[]).map(player=>Object.freeze({...evaluateCandidate(player,need,phase),competition:estimateCompetition(player,model,profile)})),pairs=pairCandidates(candidates,drops,phase,contextByPlayer),acts=pairs.filter(pair=>pair.action===ACTION.ACT),waits=pairs.filter(pair=>pair.action===ACTION.WAIT),top=acts[0]||waits[0]||pairs[0]||null,action=acts.length?ACTION.ACT:waits.length?ACTION.WAIT:ACTION.HOLD,sharinganPick=acts[0]||null,sharinganWatch=!sharinganPick?(waits[0]||null):null;
    if(candidates.length&&!candidates.some(candidate=>candidate.eligible))return insufficientResult('Available-player identity, source value, or ownership evidence is unresolved.',model,need,candidates,drops);
    if(candidates.some(candidate=>candidate.eligible)&&!drops.some(drop=>[DROP.DROPPABLE,DROP.PRIORITY_DROP].includes(drop.state))&&drops.some(drop=>drop.state===DROP.RELUCTANT_DROP))return insufficientResult('Drop candidate evidence is unresolved.',model,need,candidates,drops);
    const ev=sharinganPick?evidenceOf(sharinganPick.player):{},chidori=!model.demo&&sharinganPick&&sharinganPick.confidence>=.95&&(sharinganPick.dimensions.role??0)>=90&&(sharinganPick.dimensions.opportunity??0)>=90&&(sharinganPick.dimensions.acquisitionCost??100)<=15&&(sharinganPick.dimensions.championshipEquity??0)>=85&&(sharinganPick.netGain??0)>=35?sharinganPick:null;
    const actionable=pairs.filter(pair=>pair.action!=='HOLD'&&pair.drop),fallbackPlan=Object.freeze([...actionable.slice(0,2).map((pair,index)=>Object.freeze({priority:index+1,addPlayerId:pair.canonicalPlayerId,dropPlayerId:pair.drop.canonicalPlayerId,action:pair.action,bid:null,advisoryOnly:true})),Object.freeze({priority:Math.min(3,actionable.length+1),action:'HOLD',advisoryOnly:true})]);
    return Object.freeze({status:'EVALUATED',action,timing:Object.freeze({action,headline:action===ACTION.ACT?'CLEAR ROSTER UPGRADE':action===ACTION.WAIT?'MONITOR THE WAIVER WINDOW':'NO MOVE CLEARS THE BAR',reason:top?.reason||'No available move has sufficient validated evidence.'}),reason:top?.reason||null,need,candidates:Object.freeze(candidates),drops:Object.freeze(drops),pairs:Object.freeze(pairs),fallbackPlan,signals:Object.freeze({sharinganPick,sharinganWatch,sharinganHold:!sharinganPick&&!sharinganWatch,chidori}),faab:faabContract(model),provenance:Object.freeze({seasonSource:model.manualAuthority?.complete?'USER_CONFIRMED':model.sourceLabel,profileId:model.profileId,availabilitySource:model.manualAuthority?.complete?'USER_CONFIRMED':'Yahoo',evaluatedAt:null})});
  }
  return Object.freeze({ACTION,NEED,DROP,TIERS,configuredSlots,trustworthy,assessRosterNeed,evaluateDrop,evaluateCandidate,estimateCompetition,faabContract,pairCandidates,PROTECTION,transactionProtection,currentWeekTransaction,evaluateCurrentWeek,evaluate});
});
