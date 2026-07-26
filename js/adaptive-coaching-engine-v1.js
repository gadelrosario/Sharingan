(function(root){
  'use strict';

  const PHASES={FOUNDATION:'FOUNDATION',BUILD:'BUILD','BOARD_CONTROL':'BOARD CONTROL',OPTIMIZE:'OPTIMIZE',FINISH:'FINISH'};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Math.round(Number(value)||0)));
  const pos=value=>{
    const normalized=String(value??'').trim().toUpperCase().replace(/[.\s_-]/g,'');
    return ['DST','D/ST','DEF','DEFENSE'].includes(normalized)?'DST':normalized;
  };
  const clean=(value,fallback='')=>String(value??'').trim()||fallback;
  const sentence=(value,max=110)=>{
    const text=clean(value,'Board context is still developing.').replace(/\s+/g,' ');
    return text.length<=max?text:`${text.slice(0,max-1).trim()}…`;
  };
  const rosterCount=(counts,position)=>Number(counts?.[position])||0;
  const starterTarget=(slots,position)=>Number(slots?.[position])||0;
  const starterOpen=(counts,slots,position)=>rosterCount(counts,position)<starterTarget(slots,position);
  const skillStarterOpen=(counts,slots)=>['RB','WR','TE'].some(position=>starterOpen(counts,slots,position));

  function draftPhase(context={}){
    const teams=Math.max(1,Number(context.leagueSize)||10),derivedRound=Math.ceil((Number(context.currentPick)||1)/teams);
    const round=Math.max(1,Number(context.round)||derivedRound),rosterSize=Math.max(1,Number(context.rosterSize)||17);
    const drafted=Math.max(0,Number(context.draftedCount)||0),remaining=Math.max(0,rosterSize-drafted);
    const counts=context.counts||{},slots=context.starterSlots||{};
    const specialistOnly=!skillStarterOpen(counts,slots)&&!starterOpen(counts,slots,'QB')&&
      (starterOpen(counts,slots,'K')||starterOpen(counts,slots,'DST'));
    if(remaining<=2||specialistOnly||(round>=Math.max(12,rosterSize-2)&&remaining<=4))return PHASES.FINISH;
    if(round<=2&&drafted<3)return PHASES.FOUNDATION;
    if(round<=5||(round<=6&&skillStarterOpen(counts,slots)))return PHASES.BUILD;
    const coreFilled=!skillStarterOpen(counts,slots)&&!starterOpen(counts,slots,'QB');
    if(round<=10&&!coreFilled)return PHASES.BOARD_CONTROL;
    if(round<=10)return PHASES.BOARD_CONTROL;
    return PHASES.OPTIMIZE;
  }

  function openingMessage(player){
    const position=pos(player?.position||player?.pos),name=clean(player?.name,'the top recommendation');
    if(position==='WR')return {messageType:'ELITE_WR_OPENING',headline:'Elite WR Opening',instruction:`Draft ${name}.`,reason:'Highest-value receiving foundation from this board.'};
    if(position==='RB')return {messageType:'ANCHOR_RB_OPENING',headline:'Anchor RB Start',instruction:`Draft ${name}.`,reason:'Build around the strongest available backfield workload and ceiling.'};
    if(['TE','QB'].includes(position))return {messageType:'POSITIONAL_EDGE_OPENING',headline:'Positional Edge',instruction:`Draft ${name}.`,reason:`Creates an early weekly advantage at ${position}.`};
    return {messageType:'BEST_VALUE_OPENING',headline:'Best Value Opening',instruction:`Draft ${name}.`,reason:'Take the strongest opening value while preserving roster flexibility.'};
  }

  function normalMessage(phase,player,context){
    const position=pos(player?.position||player?.pos),name=clean(player?.name,'the top recommendation');
    const counts=context.counts||{},slots=context.starterSlots||{},open=starterOpen(counts,slots,position);
    if(phase===PHASES.FOUNDATION)return openingMessage(player);
    if(phase===PHASES.BUILD){
      if(position==='WR'&&open)return {messageType:'COMPLETE_WR_CORE',headline:'Build the WR Core',instruction:`Draft ${name}.`,reason:'Adds a needed starting receiver without leaving the best-value path.'};
      if(position==='RB'&&open)return {messageType:'COMPLETE_RB_CORE',headline:'Build the RB Core',instruction:`Draft ${name}.`,reason:'Adds a needed starting back while the current value is available.'};
      if(position==='TE'&&open)return {messageType:'SECURE_TE_EDGE',headline:'Secure the TE Edge',instruction:`Draft ${name}.`,reason:'Fills the starting tight-end slot with the strongest current option.'};
      if(position==='QB'&&open)return {messageType:'SECURE_QB',headline:'Secure Quarterback',instruction:`Draft ${name}.`,reason:'The board now supports filling the starting quarterback slot.'};
      return {messageType:'BALANCE_BUILD',headline:'Balance the Build',instruction:`Draft ${name}.`,reason:'Strengthens the opening core with the best supported roster fit.'};
    }
    if(phase===PHASES.BOARD_CONTROL){
      const depth=Number(context.similarAtPosition)||0;
      if(depth>=5&&context.waitSupported&&position!=='QB')return {messageType:'WAIT_ON_POSITION',headline:'Exploit QB Depth',instruction:`Wait one round on QB. Draft ${name}.`,reason:'Five comparable quarterbacks remain behind this pick.'};
      return {messageType:'TAKE_FALLING_VALUE',headline:'Control the Board',instruction:`Draft ${name}.`,reason:'Use the current board window before the turn changes the available tier.'};
    }
    if(phase===PHASES.FINISH){
      const messageType=position==='K'?'ADD_KICKER':position==='DST'?'ADD_DST':open?'FILL_STARTER':'FINAL_UPSIDE_PICK';
      const headline=position==='K'?'Secure the Kicker':position==='DST'?'Draft a Defense':open?'Fill the Final Starter':'Final Upside Swing';
      return {messageType,headline,instruction:`Draft ${name}.`,reason:open?'Completes a remaining required roster slot.':'Use the final roster space on the best remaining upside.'};
    }
    return {messageType:'SWING_FOR_UPSIDE',headline:'Raise the Ceiling',instruction:`Draft ${name}.`,reason:'Adds the strongest available upside to an established starting core.'};
  }

  function eventMessage(player,context){
    const name=clean(player?.name,'the recommended player'),position=pos(player?.position||player?.pos);
    if(context.eternal)return {eventType:'OPPORTUNITY',messageType:'OPPORTUNITY',headline:'Elite Value Has Fallen',instruction:`Draft ${name}.`,reason:'An Eternal-level value fall overrides the routine phase message.',isOverride:true};
    if(context.tierCliff?.nearCliff&&Number(context.tierCliff.remainingInTier)<=0)return {eventType:'TIER_BREAK',messageType:'FINAL_PLAYER_IN_TIER',headline:'Tier Break',instruction:`Draft ${name}.`,reason:`Last clearly superior ${position} in the current tier.`,isOverride:true};
    if(context.roomOverreaction?.active&&context.roomOverreaction.position!==position)return {eventType:'ROOM_OVERREACTION',messageType:'ROOM_OVERREACTION',headline:'Room Overreaction',instruction:`Draft ${name}.`,reason:`The ${context.roomOverreaction.position} run created value at ${position}.`,isOverride:true};
    if(context.positionalEdge&&['QB','TE'].includes(position))return {eventType:'POSITIONAL_EDGE',messageType:'POSITIONAL_EDGE_OPENING',headline:'Positional Edge',instruction:`Draft ${name}.`,reason:`The existing signals support a meaningful weekly advantage at ${position}.`,isOverride:true};
    return null;
  }

  function buildCoachingDecision(context={}){
    const primary=context.primaryRecommendation||context.recommendations?.[0]||null;
    const phaseId=draftPhase(context),phaseLabel=phaseId;
    if(!primary)return {phaseId,phaseLabel,messageType:'NO_RECOMMENDATION',headline:'Board Update',instruction:'No recommendation is currently available.',targetPlayerId:null,targetPlayerName:null,targetPosition:null,confidence:clamp(context.confidence,0,100),reason:'Wait for the player pool to refresh.',secondaryReason:'',primaryRecommendationId:null,pivotRecommendationId:null,eventType:null,isOverride:false};
    const player={id:primary.id,name:primary.name,position:primary.position||primary.pos};
    const event=eventMessage(player,context),message=event||normalMessage(phaseId,player,context);
    const pivot=context.pivotRecommendation||context.recommendations?.find(item=>item?.id!==primary.id)||null;
    return {
      phaseId,phaseLabel,eventType:message.eventType||null,messageType:message.messageType,
      headline:sentence(message.headline,40),instruction:sentence(message.instruction,70),
      targetPlayerId:primary.id,targetPlayerName:clean(primary.name),targetPosition:pos(primary.position||primary.pos),
      confidence:clamp(context.confidence,0,100),reason:sentence(message.reason,110),
      secondaryReason:sentence(context.secondaryReason||'',110),primaryRecommendationId:primary.id,
      pivotRecommendationId:pivot?.id??null,pivotRecommendationName:pivot?.name||null,isOverride:Boolean(message.isOverride)
    };
  }

  root.AdaptiveCoachingEngineV1={PHASES,draftPhase,buildCoachingDecision};
})(typeof window!=='undefined'?window:globalThis);
