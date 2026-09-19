(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FantasyHQSeasonHomeV3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const POSITIONS=Object.freeze(['QB','RB','WR','TE','FLEX','K','DST']);
  const finite=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
  const clean=value=>String(value??'').trim();
  const freeze=value=>Object.freeze(value);
  const normalizePosition=value=>{const text=clean(value).toUpperCase().replace(/[^A-Z]/g,'');return text==='DEF'||text==='DEFENSE'||text==='DST'?'DST':text;};
  const projection=player=>finite(player?.currentWeek?.outlookContribution?.value??player?.projection??player?.projectedPoints??player?.yahooProjection);
  function freshness({fetchedAt,lastSuccessfulSyncAt,now=Date.now()}={}){
    const stamp=Date.parse(lastSuccessfulSyncAt||fetchedAt||'');
    if(!Number.isFinite(stamp))return freeze({state:'UNKNOWN',ageMinutes:null,label:'Update time unavailable'});
    const ageMinutes=Math.max(0,Math.floor((Number(now)-stamp)/60000));
    const state=ageMinutes<=30?'FRESH':ageMinutes<=180?'AGING':'STALE';
    return freeze({state,ageMinutes,label:ageMinutes<1?'Updated just now':`Updated ${ageMinutes} min ago`});
  }
  function gameState(player,{now=Date.now(),startingSoonMinutes=90}={}){
    const explicit=clean(player?.gameStatus||player?.gameState).toUpperCase().replace(/[ -]+/g,'_');
    if(['FINAL','COMPLETED'].includes(explicit))return freeze({state:'FINAL',locked:true,startTime:null});
    if(['IN_PROGRESS','LIVE','MIDEVENT'].includes(explicit))return freeze({state:'IN_PROGRESS',locked:true,startTime:null});
    if(player?.locked===true)return freeze({state:'IN_PROGRESS',locked:true,startTime:null});
    const raw=player?.gameStart||player?.gameTimeUtc||player?.kickoffAt||player?.startTime,
      startTime=Date.parse(raw||'');
    if(!Number.isFinite(startTime))return freeze({state:'UNKNOWN',locked:false,startTime:null});
    const delta=startTime-Number(now);
    if(delta<=0)return freeze({state:'IN_PROGRESS',locked:true,startTime:new Date(startTime).toISOString()});
    if(delta<=startingSoonMinutes*60000)return freeze({state:'STARTING_SOON',locked:false,startTime:new Date(startTime).toISOString()});
    return freeze({state:'NOT_STARTED',locked:false,startTime:new Date(startTime).toISOString()});
  }
  function groupRows(rows=[]){
    const groups=Object.fromEntries(POSITIONS.map(position=>[position,[]]));
    rows.forEach(row=>{const slot=normalizePosition(row?.slot||row?.slotLabel||row?.player?.rosterSlot||row?.player?.position);if(groups[slot])groups[slot].push(row)});
    return groups;
  }
  function positionBattle(userRows=[],opponentRows=[]){
    const user=groupRows(userRows),opponent=groupRows(opponentRows);
    return freeze(POSITIONS.map(position=>{
      const left=user[position],right=opponent[position],leftValues=left.map(row=>projection(row.player)),rightValues=right.map(row=>projection(row.player)),complete=left.length>0&&right.length>0&&leftValues.every(value=>value!==null)&&rightValues.every(value=>value!==null);
      if(!complete)return freeze({position,userProjection:null,opponentProjection:null,margin:null,state:'UNAVAILABLE',evidence:'PARTIAL'});
      const userProjection=leftValues.reduce((sum,value)=>sum+value,0),opponentProjection=rightValues.reduce((sum,value)=>sum+value,0),margin=userProjection-opponentProjection,threshold=Math.max(1.5,Math.max(userProjection,opponentProjection)*.05),state=Math.abs(margin)<threshold?'EVEN':margin>0?'YOU':'OPPONENT';
      return freeze({position,userProjection,opponentProjection,margin,state,evidence:'SUPPORTED'});
    }));
  }
  function weeklyRead(comparison,battles=[]){
    const canonical=comparison?.projectionStatus!==undefined&&comparison?.narrativeAllowed!==undefined,
      allowed=canonical?comparison.narrativeAllowed===true:false,
      user=allowed?finite(comparison?.userProjectedPoints):null,opponent=allowed?finite(comparison?.opponentProjectedPoints):null,
      supported=allowed?battles.filter(row=>row.evidence==='SUPPORTED'):[],advantages=supported.filter(row=>row.state==='YOU').sort((a,b)=>b.margin-a.margin),challenges=supported.filter(row=>row.state==='OPPONENT').sort((a,b)=>a.margin-b.margin),close=supported.filter(row=>row.state==='EVEN');
    const sentences=[];
    if(user!==null&&opponent!==null){const gap=Math.abs(user-opponent);sentences.push(gap<3?'Yahoo projects a close matchup.':`Yahoo projects you ${user>opponent?'ahead':'behind'} by ${gap.toFixed(1)} points.`)}
    if(advantages[0]||challenges[0])sentences.push(`${advantages[0]?`Your strongest projected position is ${advantages[0].position}`:'No supported positional edge is available'}${challenges[0]?`, while ${challenges[0].position} is the largest projected challenge.`:'.'}`);
    if(close[0])sentences.push(`${close[0].position} is the closest supported position battle.`);
    return freeze({supported:Boolean(sentences.length),text:sentences.slice(0,3).join(' '),reason:sentences.length?null:comparison?.projectionStatus==='STALE'?'Yahoo matchup projection is stale.':'Yahoo matchup projection is currently incomplete.',biggestAdvantage:advantages[0]||null,biggestChallenge:challenges[0]||null,closest:close[0]||null});
  }
  function outlook(model={}){
    const standing=model.homeStanding||{},analytics=model.snapshot?.seasonAnalytics||model.snapshot?.analytics||{},equity=analytics.championshipEquity||model.snapshot?.championshipEquity||null,teamFit=model.teamFitSummary||null;
    const metrics=[
      {key:'record',label:'RECORD',value:standing.record||null,source:standing.supported?'Yahoo':null},
      {key:'standing',label:'STANDING',value:standing.rank!==null&&standing.rank!==undefined?`#${standing.rank}`:null,source:standing.supported?'Yahoo':null},
      {key:'pointsFor',label:'POINTS FOR',value:finite(standing.pointsFor),source:standing.supported?'Yahoo':null},
      {key:'pointsAgainst',label:'POINTS AGAINST',value:finite(standing.pointsAgainst),source:standing.supported?'Yahoo':null},
      {key:'playoffOdds',label:'PLAYOFF ODDS',value:finite(analytics.playoffOdds),source:analytics.playoffOddsSource||null},
      {key:'championshipEquity',label:'CHAMPIONSHIP EQUITY',value:finite(equity?.score??equity?.value),source:equity?.source||null,additive:true},
      {key:'powerRank',label:'POWER RANK',value:finite(analytics.powerRank),source:analytics.powerRankSource||null},
      {key:'rosterStrength',label:'ROSTER STRENGTH',value:finite(teamFit?.rosterStrengthScore??teamFit?.components?.rosterStrengthScore),source:teamFit?.rosterStrengthSource||null},
    ];
    return freeze(metrics.map(metric=>freeze(metric)));
  }
  function confidenceLabel(value,sampleSize=null){const score=finite(value);if(score===null)return'UNSCORED';if(sampleSize!==null&&sampleSize<2)return'LOW';return score>=82?'HIGH':score>=65?'MEDIUM':'LOW';}
  function decisionWindow(players=[],options={}){
    const states=players.map(player=>({player,state:gameState(player,options)})),unlocked=states.filter(row=>!row.state.locked&&row.state.startTime).sort((a,b)=>a.state.startTime.localeCompare(b.state.startTime));
    if(unlocked[0])return freeze({state:unlocked[0].state.state,nextKickoff:unlocked[0].state.startTime,playerId:unlocked[0].player?.canonicalPlayerId||unlocked[0].player?.playerId||null,label:unlocked[0].state.state==='STARTING_SOON'?'Lineup decision soon':'Next player kickoff'});
    if(states.some(row=>row.state.locked))return freeze({state:'ACTIVE_GAMES',nextKickoff:null,playerId:null,label:'Some roster players are locked'});
    return freeze({state:'UNKNOWN',nextKickoff:null,playerId:null,label:'Kickoff times unavailable'});
  }
  function decisionPresentation(plan={}){
    const supported=[...(plan.actionQueue||[]),...(plan.watchQueue||[]).filter(item=>['CRITICAL','HIGH','MEDIUM'].includes(item?.priority))],seen=new Set(),items=supported.filter(item=>item?.id&&!seen.has(item.id)&&seen.add(item.id)).slice(0,3),hold=!items.length&&plan.primaryAction?.type==='NO_ACTION';
    const visible=hold?[]:items.length?items:[plan.primaryAction].filter(Boolean);
    return freeze({kind:hold?'HOLD':'QUEUE',count:hold?0:visible.length,items:freeze(visible.slice()),primaryAction:plan.primaryAction||null});
  }
  return freeze({POSITIONS,finite,normalizePosition,projection,freshness,gameState,positionBattle,weeklyRead,outlook,confidenceLabel,decisionWindow,decisionPresentation});
});
