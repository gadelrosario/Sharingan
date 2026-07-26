(function(root){
  'use strict';
  const POSITIONS=['QB','RB','WR','TE'];
  const TIER_ORDER=['S','A','B','C','D','E','F'];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Math.round(Number(value)||0)));
  const pos=value=>{const p=String(value??'').trim().toUpperCase().replace(/[.\s_-]/g,'');return ['DST','D/ST','DEF','DEFENSE'].includes(p)?'DST':p};
  const tier=value=>{const t=String(value??'').trim().toUpperCase();return TIER_ORDER.includes(t)?t:null};
  const countPosition=(items,position,n)=>items.slice(-n).filter(item=>pos(item?.position??item?.pos)===position).length;

  function teamForPick(overallPick,leagueSize=10){const size=Math.max(2,Number(leagueSize)||10),round=Math.ceil(overallPick/size),inRound=(overallPick-1)%size+1;return round%2?inRound:size+1-inRound}
  function snakeWindow({currentPick=1,userSlot=1,leagueSize=10,totalPicks=170}={}){
    const size=Math.max(2,Number(leagueSize)||10),current=Math.max(1,Number(currentPick)||1),slot=clamp(userSlot,1,size),limit=Math.max(current+1,Number(totalPicks)||size*17);
    let next=current+1;while(next<=limit&&teamForPick(next,size)!==slot)next++;
    if(next>limit)return {nextUserPick:null,picksBetween:Math.max(0,limit-current),pickNumbers:[],teamSlots:[],uniqueTeamSlots:[],backToBackManagers:[]};
    const pickNumbers=[],teamSlots=[];for(let pick=current+1;pick<next;pick++){pickNumbers.push(pick);teamSlots.push(teamForPick(pick,size))}
    const backToBackManagers=[];for(let index=1;index<teamSlots.length;index++)if(teamSlots[index]===teamSlots[index-1]&&!backToBackManagers.includes(teamSlots[index]))backToBackManagers.push(teamSlots[index]);
    return {nextUserPick:next,picksBetween:pickNumbers.length,pickNumbers,teamSlots,uniqueTeamSlots:[...new Set(teamSlots)],backToBackManagers,isUserTurnBackToBack:next===current+1};
  }

  function boardTemperature(recentPicks=[]){
    const result={};
    POSITIONS.forEach(position=>{
      const last3=countPosition(recentPicks,position,3),last6=countPosition(recentPicks,position,6),last10=countPosition(recentPicks,position,10),weighted=last3*2+(last6-last3)*1.1+(last10-last6)*.45;
      const label=weighted>=8?'SURGING':weighted>=5.5?'HOT':weighted>=3?'WARM':weighted>=1?'STABLE':'COLD';
      const prior=Math.max(0,last6-last3),trend=last3>prior?'accelerating':last3<prior?'cooling':'steady';
      result[position]={position,label,recentCount:last6,windowSize:Math.min(6,recentPicks.length),trend,counts:{last3,last6,last10}};
    });
    return result;
  }

  function detectRun({recentPicks=[],managerNeedCounts={}}={}){
    const temperatures=boardTemperature(recentPicks),runs=POSITIONS.map(position=>{
      const counts=temperatures[position].counts,need=Number(managerNeedCounts[position])||0;let status='NONE';
      if(recentPicks.length>=6&&counts.last10>=4&&counts.last6<=1)status='ENDED';
      else if(recentPicks.length>=6&&counts.last10>=4&&counts.last6>=2&&counts.last3===0)status='SLOWING';
      else if(counts.last6>=4&&counts.last3>=3&&counts.last6-counts.last3<=1)status='ACCELERATING';
      else if(counts.last6>=4)status='ACTIVE';
      else if(counts.last6===3&&counts.last3>=2&&need>=2)status='STARTING';
      const strength=status==='ACCELERATING'?'STRONG':status==='ACTIVE'?'MODERATE':status==='STARTING'||status==='SLOWING'?'WEAK':'NONE';
      return {position,status,strength,temperature:temperatures[position],recentCount:counts.last6};
    });
    const priority={ACCELERATING:5,ACTIVE:4,STARTING:3,SLOWING:2,ENDED:1,NONE:0};
    runs.sort((a,b)=>priority[b.status]-priority[a.status]);
    const strongest=runs[0];
    return strongest.status==='NONE'?{position:null,status:'NONE',strength:'NONE',recentCount:0,temperature:null}:strongest;
  }

  function managerSignals(managersBefore=[]){
    return managersBefore.map(manager=>{
      const name=String(manager?.name||'Unknown manager'),archetype=String(manager?.archetype||''),counts=manager?.counts||{};
      if(name==='Unknown manager'||!archetype)return {team:manager?.team??null,name,position:null,strength:'weak signal',text:'Manager tendency is unavailable.'};
      if(Number(manager.qbHoard)>=7&&Number(counts.QB||0)<2)return {team:manager.team,name,position:'QB',strength:'moderate signal',text:`${name} may take another quarterback to control the room.`};
      if(/Value/i.test(archetype))return {team:manager.team,name,position:null,strength:'weak signal',text:`${name} usually allows value to guide the pick.`};
      if(/Instinct|Reactionary|Conviction/i.test(archetype))return {team:manager.team,name,position:null,strength:'weak signal',text:`${name} may reach when a preferred target appears.`};
      if(/AI/i.test(archetype))return {team:manager.team,name,position:null,strength:'weak signal',text:`${name} tends to follow consensus value.`};
      return {team:manager.team,name,position:null,strength:'weak signal',text:`${name} has no strong position signal.`};
    });
  }

  function needCounts(managersBefore=[]){const out={QB:0,RB:0,WR:0,TE:0};managersBefore.forEach(manager=>{const c=manager.counts||{};if(Number(c.QB||0)<1)out.QB++;if(Number(c.RB||0)<2)out.RB++;if(Number(c.WR||0)<3)out.WR++;if(Number(c.TE||0)<1)out.TE++});return out}

  function tierScarcity({availablePlayers=[],recommendation=null,window,run,managerNeedCounts={}}={}){
    const byPosition={};
    POSITIONS.forEach(position=>{
      const available=availablePlayers.filter(player=>pos(player.position??player.pos)===position),targetTier=position===pos(recommendation?.position??recommendation?.pos)?tier(recommendation?.tier):tier(available[0]?.tier),index=TIER_ORDER.indexOf(targetTier),nextTier=index>=0?TIER_ORDER[index+1]||null:null;
      const current=targetTier?available.filter(player=>tier(player.tier)===targetTier).length:0,next=nextTier?available.filter(player=>tier(player.tier)===nextTier).length:0;
      const runBoost=run?.position===position&&['ACTIVE','ACCELERATING'].includes(run.status)?1:0,demand=Math.min(window?.picksBetween||0,Math.max(0,Number(managerNeedCounts[position])||0)+runBoost),projected=Math.min(current,demand),remainingAfter=Math.max(0,current-projected);
      let risk='LOW';if(current&&remainingAfter===0&&demand>=current)risk=current===1?'CRITICAL':'HIGH';else if(current&&remainingAfter===1)risk='MODERATE';
      byPosition[position]={position,currentTier:targetTier,nextTier,remainingCurrentTier:current,remainingNextTier:next,projectedBeforeNextPick:projected,projectedRemaining:remainingAfter,tierDropRisk:risk};
    });return byPosition;
  }

  function availabilityProjection({recommendation,window,run,scarcity,round=1,dataQuality='LOW'}={}){
    if(!recommendation)return {playerId:null,availabilityLabel:'UNKNOWN',probabilityBand:null,rationale:'No recommendation is available.'};
    const position=pos(recommendation.position??recommendation.pos),tierState=scarcity?.[position]||{},picks=window?.picksBetween||0;
    let survival=92-picks*4;if(run?.position===position&&run.status==='ACTIVE')survival-=14;if(run?.position===position&&run.status==='ACCELERATING')survival-=22;if(tierState.tierDropRisk==='CRITICAL')survival-=28;else if(tierState.tierDropRisk==='HIGH')survival-=18;if(Number(recommendation.overall)>0&&Number(recommendation.currentPick)>Number(recommendation.overall))survival-=8;if(round<=2)survival+=4;survival=clamp(survival,3,95);
    let availabilityLabel,probabilityBand;if(survival>=85){availabilityLabel='LIKELY';probabilityBand='85–95%'}else if(survival>=70){availabilityLabel='LIKELY';probabilityBand='70–85%'}else if(survival>=50){availabilityLabel='UNCERTAIN';probabilityBand='50–70%'}else if(survival>=30){availabilityLabel='UNCERTAIN';probabilityBand='30–50%'}else if(survival>=10){availabilityLabel='UNLIKELY';probabilityBand='10–30%'}else{availabilityLabel='UNLIKELY';probabilityBand='under 10%'}
    const soft=dataQuality==='LOW'?'may tighten':'is projected to tighten';
    return {playerId:recommendation.id,availabilityLabel,probabilityBand,rationale:availabilityLabel==='LIKELY'?`${position} access should remain available through the turn.`:`${position} access ${soft} before your next pick.`};
  }

  function flightRisk({recommendation,availability,scarcity}={}){
    if(!recommendation)return {severity:'NONE',consequence:'No recommendation to evaluate.',affectedPosition:null,projectedFallback:null,tierDelta:0,explanation:'Flight risk is unavailable.'};
    const position=pos(recommendation.position??recommendation.pos),state=scarcity?.[position]||{},current=state.currentTier,next=state.nextTier;
    if(state.tierDropRisk==='CRITICAL')return {severity:'CRITICAL',consequence:'Current tier likely depleted',affectedPosition:position,projectedFallback:next,tierDelta:1,explanation:`Passing likely moves the next ${position} option from Tier ${current} to Tier ${next||'below the tracked range'}.`};
    if(state.tierDropRisk==='HIGH'||availability?.availabilityLabel==='UNLIKELY')return {severity:'HIGH',consequence:'Player likely gone',affectedPosition:position,projectedFallback:next,tierDelta:state.tierDropRisk==='HIGH'?1:0,explanation:`${recommendation.name||'The recommendation'} is unlikely to survive the turn.`};
    if(availability?.availabilityLabel==='UNCERTAIN')return {severity:'MODERATE',consequence:'Availability uncertain',affectedPosition:position,projectedFallback:current,tierDelta:0,explanation:`The current ${position} path may tighten, but an alternative remains.`};
    return {severity:'LOW',consequence:'Alternative path remains strong',affectedPosition:position,projectedFallback:current,tierDelta:0,explanation:`${position} depth remains strong; waiting preserves flexibility.`};
  }

  function qualityFor({recentPicks=[],managersBefore=[],availablePlayers=[],rostersComplete=false}={}){if(recentPicks.length>=6&&managersBefore.length&&availablePlayers.length&&rostersComplete)return'HIGH';if(recentPicks.length>=3&&availablePlayers.length)return'MODERATE';return'LOW'}
  function timingFor({run,scarcity,flight,recommendation,availablePlayers=[]}={}){
    const position=pos(recommendation?.position??recommendation?.pos),state=scarcity?.[position]||{};
    if(state.tierDropRisk==='CRITICAL')return {label:'PROTECT THE TIER',eventType:'TIER_BREAK'};
    if(run?.status==='ACCELERATING'&&run.position!==position){const eliteElsewhere=availablePlayers.some(player=>pos(player.position??player.pos)===position&&['S','A'].includes(tier(player.tier)));if(eliteElsewhere)return {label:'EXPLOIT OVERREACTION',eventType:'ROOM_OVERREACTION'}}
    if(flight?.severity==='HIGH'||flight?.severity==='CRITICAL')return {label:'ACT NOW',eventType:'HIGH_FLIGHT_RISK'};
    if(run?.status==='ACTIVE'||run?.status==='ACCELERATING')return {label:'MONITOR RUN',eventType:'POSITION_RUN'};
    if(flight?.severity==='LOW')return {label:'SAFE TO WAIT',eventType:null};
    if(flight?.severity==='MODERATE')return {label:'WAIT IF TARGETING ANOTHER POSITION',eventType:null};
    return {label:'FLEXIBLE',eventType:null};
  }

  function rosterNeeds({counts={},starterSlots={}}={}){const result={};POSITIONS.forEach(position=>{const current=Math.max(0,Number(counts[position])||0),required=Math.max(0,Number(starterSlots[position])||0);result[position]={position,current,required,status:current<required?'ACTUAL_NEED':current===required?'OPTIONAL_DEPTH':'POSITIONAL_STRENGTH'}});return result}

  function analyze(context={}){
    const recommendation=context.recommendation||null,recentPicks=Array.isArray(context.recentPicks)?context.recentPicks:[],leagueSize=Number(context.leagueSize)||10;
    const window=snakeWindow({currentPick:context.currentPick,userSlot:context.userSlot,leagueSize,totalPicks:context.totalPicks}),managersAll=Array.isArray(context.managers)?context.managers:[],managerMap=new Map(managersAll.map(manager=>[Number(manager.team),manager])),managersBefore=window.uniqueTeamSlots.map(team=>managerMap.get(team)||{team,name:'Unknown manager',counts:{}}),needs=needCounts(managersBefore),run=detectRun({recentPicks,managerNeedCounts:needs}),temperatures=boardTemperature(recentPicks),quality=qualityFor({recentPicks,managersBefore,availablePlayers:context.availablePlayers||[],rostersComplete:Boolean(context.rostersComplete)}),scarcity=tierScarcity({availablePlayers:context.availablePlayers||[],recommendation,window,run,managerNeedCounts:needs}),availability=availabilityProjection({recommendation:recommendation?{...recommendation,currentPick:context.currentPick}:null,window,run,scarcity,round:context.round,dataQuality:quality}),flight=flightRisk({recommendation,availability,scarcity}),timing=timingFor({run,scarcity,flight,recommendation,availablePlayers:context.availablePlayers||[]}),signals=managerSignals(managersBefore),userNeeds=rosterNeeds({counts:context.userCounts,starterSlots:context.starterSlots});
    const early=recentPicks.length<3,keyInsight=!recommendation?'No recommendation is available.':early?'Board behavior is not established yet.':timing.label==='PROTECT THE TIER'?flight.explanation:run.status!=='NONE'?`${run.position} run is ${run.status.toLowerCase()}.`:flight.explanation;
    const recommendationPosition=pos(recommendation?.position??recommendation?.pos),lateNeed=Number(context.round)>=8&&userNeeds[recommendationPosition]?.status==='ACTUAL_NEED',rookieFoundation=Number(context.round)<=4&&recommendation?.rookie&&userNeeds[recommendationPosition]?.status==='ACTUAL_NEED';
    const rosterSignal=rookieFoundation?'Treat rookie upside as part of the foundation, not its only anchor.':lateNeed?`${recommendationPosition} still has an open starter slot; need matters more in this phase.`:null;
    const supporting=[availability.rationale,rosterSignal|| (run.status==='NONE'?(early?'Build the foundation; room intelligence will strengthen after several picks.':'No meaningful positional run is active.'):`${run.recentCount} ${run.position}s went in the last six picks.`)].filter(Boolean).slice(0,2);
    return {boardTemperature:temperatures,recentRun:run.position,runDirection:run.temperature?.trend||'steady',runStrength:run.strength,runStatus:run.status,scarcityByPosition:scarcity,currentTierRisk:recommendation?scarcity[recommendationPosition]?.tierDropRisk||'LOW':'LOW',projectedNextPickAvailability:availability,flightRisk:flight,likelyRoomBehavior:early?'NOT_ESTABLISHED':run.status,managerSignals:signals,rosterNeeds:userNeeds,timingRecommendation:timing.label,timingConfidence:quality==='HIGH'?'HIGH':quality==='MODERATE'?'MODERATE':'LOW',keyInsight,supportingInsights:supporting,eventType:timing.eventType,dataQuality:quality,snakeWindow:window,recommendationId:recommendation?.id??null,recommendationConfidence:context.recommendationConfidence??null,recommendationMamba:context.recommendationMamba??null,recommendationTier:recommendation?.tier??null};
  }

  root.DraftPsychologyEngineV1={analyze,teamForPick,snakeWindow,boardTemperature,detectRun,tierScarcity,availabilityProjection,flightRisk,managerSignals,qualityFor,timingFor,rosterNeeds};
})(typeof window!=='undefined'?window:globalThis);
