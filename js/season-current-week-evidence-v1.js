(function(root,factory){
  const liveWeek=typeof module==='object'&&module.exports?require('./nfl-live-week-v1.js'):root.FantasyHQNflLiveWeekV1;
  const api=factory(liveWeek);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FantasyHQCurrentWeekEvidenceV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(LiveWeek){
  'use strict';
  const SCHEMA='fantasy-hq-current-week-evidence-1';
  const GAME_STATE=Object.freeze({PRE_GAME:'PRE_GAME',LIVE:'LIVE',FINAL:'FINAL',LOCKED_UNKNOWN:'LOCKED_UNKNOWN',POSTPONED:'POSTPONED',CANCELLED:'CANCELLED',BYE:'BYE',UNKNOWN:'UNKNOWN'});
  const FRESHNESS=Object.freeze({CURRENT:'CURRENT',AGING:'AGING',STALE:'STALE',UNKNOWN:'UNKNOWN'});
  const THRESHOLDS=Object.freeze({
    roster:Object.freeze({current:30*60000,aging:3*3600000}),
    game:Object.freeze({current:15*60000,aging:60*60000}),
    injury:Object.freeze({current:24*3600000,aging:72*3600000}),
    projection:Object.freeze({current:6*3600000,aging:24*3600000}),
    usage:Object.freeze({current:8*86400000,aging:16*86400000}),
  });
  const clean=value=>String(value??'').trim();
  const finite=value=>value!==null&&value!==undefined&&clean(value)!==''&&Number.isFinite(Number(value))?Number(value):null;
  const iso=value=>{const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null;};
  const freeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(freeze);return Object.freeze(value);};
  const playerId=player=>clean(player?.identity?.canonicalPlayerId||player?.canonicalPlayerId||player?.playerId||player?.id);
  const lineupKey=player=>{const canonical=playerId(player);if(canonical)return`canonical:${canonical}`;const source=clean(player?.sourcePlayerKey||player?.yahooPlayerKey||player?.yahooPlayerId);return source?`source:${source}`:'';};
  const position=value=>{const text=clean(value).toUpperCase().replace(/[^A-Z]/g,'');return ['DEF','DEFENSE','DST'].includes(text)?'DST':text||null;};
  const normalizeFormat=value=>{const text=clean(value).toLowerCase().replace(/[^a-z0-9]/g,'');if(text.includes('half'))return'HALF_PPR';if(text.includes('full')||text==='ppr')return'FULL_PPR';if(text.includes('standard')||text.includes('nonppr'))return'STANDARD';return text?text.toUpperCase():null;};
  function freshness(type,observedAt,now=Date.now()){
    const stamp=Date.parse(observedAt||''),rule=THRESHOLDS[type];
    if(!rule||!Number.isFinite(stamp)||!Number.isFinite(Number(now))||Number(now)<stamp)return FRESHNESS.UNKNOWN;
    const age=Number(now)-stamp;
    return age<=rule.current?FRESHNESS.CURRENT:age<=rule.aging?FRESHNESS.AGING:FRESHNESS.STALE;
  }
  function identity(player){
    const status=clean(player?.identity?.status).toUpperCase(),id=playerId(player);
    const safe=Boolean(id&&['MATCHED','ALIAS_MATCH','ARCHIVE_RECORDED'].includes(status));
    return freeze({status:safe?status:status||'UNRESOLVED',canonicalPlayerId:safe?id:null,sourcePlayerId:clean(player?.yahooPlayerId||player?.sourcePlayerKey)||null,method:clean(player?.identity?.reason||player?.identity?.method)||null,safe});
  }
  function projection(player,{week,scoringFormat,fetchedAt,now=Date.now(),provider='Yahoo',demo=false}={}){
    const value=finite(player?.projection??player?.projectedPoints??player?.yahooProjection),source=clean(player?.projectionSource)||(value!==null&&provider==='Yahoo'?'YAHOO_PLAYER_PROJECTED_POINTS':demo&&value!==null?'SANITIZED_FIXTURE':null),projectionType=clean(player?.projectionType).toUpperCase()||null,estimate=projectionType==='SLEEPER_HALF_PPR_ESTIMATE',sourceWeek=finite(player?.projectionWeek??player?.week??week),sourceFormat=normalizeFormat(player?.projectionScoringFormat??player?.scoringFormat??scoringFormat),expectedFormat=normalizeFormat(scoringFormat),timestamp=iso(player?.projectionFetchedAt||player?.evidenceFetchedAt||fetchedAt),state=freshness('projection',timestamp,now),weekMatch=value!==null&&sourceWeek===Number(week),formatMatch=value!==null&&Boolean(sourceFormat&&(estimate||sourceFormat===expectedFormat)),resolved=identity(player),projectionId=clean(player?.projectionCanonicalPlayerId||player?.projectionPlayerId),identityMatch=resolved.safe&&(!projectionId||projectionId===resolved.canonicalPlayerId),providerAuthority=player?.projectionProvenance?.recommendationAuthority!==false,supported=value!==null&&Boolean(source)&&identityMatch&&weekMatch&&formatMatch&&providerAuthority&&[FRESHNESS.CURRENT,FRESHNESS.AGING].includes(state);
    return freeze({value:supported?value:null,rawValue:value,source:source||null,label:clean(player?.projectionLabel)||(estimate?'Sleeper Estimate':projectionType==='CUSTOM_SCORING'?'Fantasy HQ Projection':null),projectionType,week:sourceWeek,scoringFormat:sourceFormat,fetchedAt:timestamp,freshness:state,confidence:supported?(state===FRESHNESS.CURRENT?'HIGH':'MEDIUM'):'UNAVAILABLE',supported,recommendationAuthority:supported,reason:supported?null:value===null?'MISSING_VALUE':!source?'MISSING_SOURCE':!identityMatch?'IDENTITY_MISMATCH':!weekMatch?'WEEK_MISMATCH':!formatMatch?'SCORING_FORMAT_MISMATCH':!providerAuthority?'PROVIDER_NON_AUTHORITATIVE':state==='STALE'?'STALE':'UNKNOWN_FRESHNESS'});
  }
  function game(player,{now=Date.now(),fetchedAt,gameFact=null,liveWeekAvailable=false}={}){
    if(gameFact){const updatedAt=iso(gameFact.fetchedAt||fetchedAt),stateFreshness=freshness('game',updatedAt,now),state=GAME_STATE[gameFact.state]||GAME_STATE.UNKNOWN,stale=[FRESHNESS.STALE,FRESHNESS.UNKNOWN].includes(stateFreshness),locked=gameFact.locked===true||['LIVE','FINAL','LOCKED_UNKNOWN','CANCELLED'].includes(state),actionable=state==='PRE_GAME'&&!stale&&!locked;return freeze({state:stale&&state==='PRE_GAME'?GAME_STATE.UNKNOWN:state,locked,actionable,kickoff:iso(gameFact.kickoff),opponent:clean(gameFact.opponent)||null,homeAway:clean(gameFact.homeAway)||null,gameId:clean(gameFact.gameId)||null,source:'nflverse schedules',updatedAt,freshness:stateFreshness,reason:actionable||state==='FINAL'||state==='LIVE'?null:stale?'STALE_GAME_STATE':state==='LOCKED_UNKNOWN'?'LIVE_OR_FINAL_STATE_UNCONFIRMED':state==='POSTPONED'?'POSTPONED':state==='CANCELLED'?'CANCELLED':null});}
    if(liveWeekAvailable&&clean(player?.sourceTeam||player?.identity?.canonicalTeam))return freeze({state:GAME_STATE.BYE,locked:false,actionable:false,kickoff:null,opponent:null,homeAway:null,gameId:null,source:'nflverse schedules',updatedAt:iso(fetchedAt),freshness:freshness('game',fetchedAt,now),reason:'BYE_WEEK'});
    const explicit=clean(player?.gameStatus||player?.gameState).toUpperCase().replace(/[ -]+/g,'_'),kickoff=iso(player?.gameStart||player?.gameTimeUtc||player?.kickoffAt||player?.startTime),kickoffMs=Date.parse(kickoff||''),nowMs=Number(now),lockedFlag=player?.locked===true,updatedAt=iso(player?.gameStatusUpdatedAt||player?.evidenceFetchedAt||fetchedAt),stateFreshness=freshness('game',updatedAt,now),stale=[FRESHNESS.STALE,FRESHNESS.UNKNOWN].includes(stateFreshness);
    if(['FINAL','COMPLETED','POSTEVENT','COMPLETE'].includes(explicit))return freeze({state:GAME_STATE.FINAL,locked:true,actionable:false,kickoff,source:'YAHOO_GAME_STATUS',updatedAt,freshness:stateFreshness,reason:null});
    if(['IN_PROGRESS','LIVE','MIDEVENT'].includes(explicit))return freeze({state:stale?GAME_STATE.LOCKED_UNKNOWN:GAME_STATE.LIVE,locked:true,actionable:false,kickoff,source:'YAHOO_GAME_STATUS',updatedAt,freshness:stateFreshness,reason:stale?'STALE_GAME_STATE':null});
    if(['PRE_GAME','PREGAME','PREEVENT','SCHEDULED','NOT_STARTED'].includes(explicit))return freeze({state:stale?GAME_STATE.UNKNOWN:GAME_STATE.PRE_GAME,locked:lockedFlag,actionable:!stale&&!lockedFlag,kickoff,source:'YAHOO_GAME_STATUS',updatedAt,freshness:stateFreshness,reason:stale?'STALE_GAME_STATE':kickoff?null:'KICKOFF_UNKNOWN'});
    if(lockedFlag)return freeze({state:GAME_STATE.LOCKED_UNKNOWN,locked:true,actionable:false,kickoff,source:'YAHOO_LINEUP_LOCK',updatedAt,freshness:stateFreshness,reason:'GAME_STATE_UNKNOWN'});
    if(Number.isFinite(kickoffMs)&&Number.isFinite(nowMs)){
      if(kickoffMs<=nowMs)return freeze({state:GAME_STATE.LOCKED_UNKNOWN,locked:true,actionable:false,kickoff,source:'YAHOO_KICKOFF_CONSERVATIVE_LOCK',updatedAt,freshness:stateFreshness,reason:'LIVE_OR_FINAL_STATE_UNCONFIRMED'});
      return freeze({state:GAME_STATE.PRE_GAME,locked:false,actionable:true,kickoff,source:'YAHOO_KICKOFF',updatedAt,freshness:stateFreshness,reason:null});
    }
    return freeze({state:GAME_STATE.UNKNOWN,locked:false,actionable:false,kickoff:null,source:null,updatedAt,freshness:stateFreshness,reason:'GAME_AND_KICKOFF_UNKNOWN'});
  }
  function availability(player,resolved,{scope,provider='Yahoo',demo=false}={}){
    const supplied=player?.availability&&typeof player.availability==='object'?player.availability:null,raw=clean(supplied?.status||player?.availability).toUpperCase(),safe=resolved?.safe===true;
    let status=raw||'UNKNOWN';
    if(!raw&&scope==='USER_ROSTER')status='USER_ROSTERED';
    else if(!raw&&scope==='OPPONENT_ROSTER')status='OTHER_TEAM_ROSTERED';
    else if(!raw&&scope==='AVAILABLE')status='AVAILABLE';
    const actionable=safe&&(['AVAILABLE','WAIVERS','FREE_AGENT'].includes(status)||supplied?.actionable===true);
    return freeze({status:safe?status:'UNKNOWN',actionable,source:clean(supplied?.source)||(provider==='Yahoo'?'Yahoo':demo?'Sanitized fixture':null),teamKey:clean(supplied?.teamKey)||null,reason:safe?null:'IDENTITY_UNRESOLVED'});
  }
  function injury(player,record,{fetchedAt,now=Date.now()}={}){
    const raw=clean(player?.injuryStatus||record?.status).toUpperCase(),status=raw||'UNKNOWN',timestamp=iso(record?.lastUpdated||record?.provenance?.fetchedAt||fetchedAt),state=freshness('injury',timestamp,now),known=status!=='UNKNOWN',current=known&&[FRESHNESS.CURRENT,FRESHNESS.AGING].includes(state);
    return freeze({status:current?status:'UNKNOWN',rawStatus:status,source:record?'Sleeper':player?.injuryStatus?'Yahoo':null,sourcePlayerId:clean(record?.sourcePlayerId)||null,updatedAt:timestamp,freshness:state,current,reason:current?null:known&&state==='STALE'?'STALE_INJURY_EVIDENCE':'INJURY_EVIDENCE_UNAVAILABLE'});
  }
  function latestCurrentSeasonRecords(store,id,season,week){
    if(!store||typeof store.observations!=='function'||!id)return[];
    return store.observations(id).filter(row=>Number(row.season)===Number(season)&&Number.isInteger(Number(row.week))&&Number(row.week)<=Number(week));
  }
  function trend(values=[]){
    const known=values.filter(Number.isFinite).slice(-3);
    if(known.length<2)return'INSUFFICIENT_SAMPLE';
    if(known.length<3)return'EARLY_SAMPLE';
    if(known[0]<known[1]&&known[1]<known[2])return'RISING';
    if(known[0]>known[1]&&known[1]>known[2])return'FALLING';
    const scale=Math.max(1,...known.map(Math.abs));
    return(Math.max(...known)-Math.min(...known))/scale<=.08?'STABLE':'MIXED';
  }
  function usage(store,id,{season,week,now=Date.now()}={}){
    const rows=latestCurrentSeasonRecords(store,id,season,week),weeks=[...new Set(rows.map(row=>Number(row.week)))].sort((a,b)=>a-b),byWeek=key=>weeks.map(value=>{const records=rows.filter(row=>Number(row.week)===value),numbers=records.map(row=>finite(key.split('.').reduce((item,part)=>item?.[part],row))).filter(Number.isFinite);return numbers.length?numbers.at(-1):null;}),latest=rows.at(-1)||null,timestamp=latest?.observedAt||latest?.fetchedAt||null,state=freshness('usage',timestamp,now),metrics={snapShare:byWeek('role.snapShare'),routeParticipation:byWeek('role.routeParticipation'),targets:byWeek('opportunity.targets'),carries:byWeek('opportunity.carries'),opportunities:byWeek('opportunity.opportunities')},trends=Object.fromEntries(Object.entries(metrics).map(([key,values])=>[key,trend(values)])),available=rows.length>0;
    return freeze({available,sampleWeeks:weeks.length,sampleQuality:weeks.length>=3?'MULTI_WEEK':weeks.length===2?'DEVELOPING':weeks.length===1?'ONE_GAME':'NONE',freshness:state,latestWeek:weeks.at(-1)||null,metrics:freeze(Object.fromEntries(Object.entries(metrics).map(([key,values])=>[key,values.at(-1)??null]))),trends:freeze(trends),sourceEvidenceIds:freeze(rows.map(row=>row.evidenceId).filter(Boolean)),recommendationAuthority:false,reason:available?weeks.length===1?'Week 2 has only one completed-game sample; usage remains context-only.':null:'Current-season usage evidence unavailable.'});
  }
  function injuryIndex(snapshot){return new Map((snapshot?.records||[]).map(record=>[clean(record?.playerId),record]).filter(([id])=>id));}
  function enrichPlayer(player,context={}){
    const resolved=identity(player),id=resolved.canonicalPlayerId,teamValue=resolved?.canonicalTeam||player?.identity?.canonicalTeam||player?.sourceTeam,gameFact=context.liveWeek?LiveWeek?.teamGame(context.liveWeek,teamValue):null,gameEvidence=game(player,{...context,gameFact,liveWeekAvailable:context.liveWeek?.status==='AVAILABLE'}),projectionEvidence=projection(player,context),availabilityEvidence=availability(player,resolved,context),injuryRecord=context.injuries?.get(id)||null,injuryEvidence=injury(player,injuryRecord,context),usageEvidence=usage(context.evidenceStore,id,{season:context.season,week:context.week,now:context.now}),actual=finite(player?.actualPoints),actualWeek=finite(player?.actualPointsWeek??context.week),actualSupported=actual!==null&&actualWeek===Number(context.week),completed=gameEvidence.state===GAME_STATE.FINAL,live=gameEvidence.state===GAME_STATE.LIVE,contribution=completed&&actualSupported?freeze({value:actual,source:player?.actualPointsSource||'YAHOO_PLAYER_POINTS',kind:'ACTUAL'}):gameEvidence.state===GAME_STATE.PRE_GAME&&projectionEvidence.supported?freeze({value:projectionEvidence.value,source:projectionEvidence.source,kind:'PROJECTION'}):null;
    const currentWeek=freeze({schema:SCHEMA,identity:resolved,season:Number(context.season)||null,week:Number(context.week)||null,lineupSlot:clean(player?.rosterSlot)||null,eligiblePositions:freeze([...(player?.eligiblePositions||[])].map(position).filter(Boolean)),availability:availabilityEvidence,opponent:gameEvidence.opponent||clean(player?.opponent)||null,game:gameEvidence,injury:injuryEvidence,projection:projectionEvidence,actual:freeze({value:actualSupported?actual:null,rawValue:actual,week:actualWeek,source:actualSupported?(player?.actualPointsSource||'YAHOO_PLAYER_POINTS'):null,fetchedAt:iso(player?.actualPointsFetchedAt||context.fetchedAt),scoringFormat:normalizeFormat(context.scoringFormat),supported:actualSupported,reason:actualSupported?null:actual===null?'MISSING_VALUE':'WEEK_MISMATCH'}),usage:usageEvidence,outlookContribution:contribution,liveExpectationSupported:live&&finite(player?.liveExpectedPoints)!==null,recommendationAuthority:false,provenance:freeze({roster:context.provider==='Yahoo'?'Yahoo':context.demo?'Sanitized fixture':null,rosterFetchedAt:iso(context.fetchedAt),game:gameEvidence.source,projection:projectionEvidence.source,actual:actualSupported?(player?.actualPointsSource||'YAHOO_PLAYER_POINTS'):null,injury:injuryEvidence.source,usage:usageEvidence.available?'FantasyHQSeasonEvidenceV1':null})});
    return freeze({...player,canonicalPlayerId:id||player?.canonicalPlayerId||null,opponent:gameEvidence.opponent||clean(player?.opponent)||null,gameStart:gameEvidence.kickoff||player?.gameStart||null,gameStatus:gameEvidence.state,locked:gameEvidence.locked,injuryStatus:injuryEvidence.current?injuryEvidence.status:clean(player?.injuryStatus)||null,projection:projectionEvidence.supported?projectionEvidence.value:null,currentWeek});
  }
  function remapLineup(lineup,index){
    if(!lineup)return null;
    const rows=name=>(lineup[name]||[]).map(row=>freeze({...row,player:row?.player?index.get(lineupKey(row.player))||index.get(`source:${clean(row.player?.sourcePlayerKey||row.player?.yahooPlayerKey||row.player?.yahooPlayerId)}`)||row.player:null}));
    return freeze({...lineup,starters:freeze(rows('starters')),bench:freeze(rows('bench')),ir:freeze(rows('ir')),unassigned:freeze(rows('unassigned'))});
  }
  function outlook(lineup){
    const starters=(lineup?.starters||[]).filter(row=>row?.player),components=[],unavailable=[];
    if(!starters.length)return freeze({status:'UNAVAILABLE',value:null,components:freeze([]),unavailable:freeze(['STARTERS_UNAVAILABLE']),source:'FANTASY_HQ_CURRENT_OUTLOOK',reason:'Current starters are unavailable.'});
    starters.forEach(row=>{const evidence=row.player.currentWeek,gameState=evidence?.game?.state,actual=evidence?.actual?.value,projectionValue=evidence?.projection?.value;if(gameState===GAME_STATE.FINAL&&actual!==null)components.push(freeze({playerId:playerId(row.player),slot:row.slot,value:actual,kind:'ACTUAL',source:'YAHOO_PLAYER_POINTS'}));else if(gameState===GAME_STATE.PRE_GAME&&projectionValue!==null)components.push(freeze({playerId:playerId(row.player),slot:row.slot,value:projectionValue,kind:'PROJECTION',source:evidence.projection.source}));else unavailable.push(`${playerId(row.player)||row.player.name}:${gameState||'UNKNOWN'}`);});
    const complete=components.length===starters.length&&!unavailable.length,value=complete?components.reduce((sum,row)=>sum+row.value,0):null;
    return freeze({status:complete?'AVAILABLE':'UNAVAILABLE',value,components:freeze(components),unavailable:freeze(unavailable),source:'FANTASY_HQ_CURRENT_OUTLOOK',reason:complete?null:'At least one starter lacks a semantically safe actual-or-projection component.',noDoubleCounting:components.every(row=>['ACTUAL','PROJECTION'].includes(row.kind))});
  }
  function summarize(players=[]){
    const evidence=players.map(player=>player.currentWeek).filter(Boolean),count=state=>evidence.filter(row=>row.game.state===state).length,unlocked=evidence.filter(row=>row.game.actionable),injuries=evidence.filter(row=>row.injury.current&&!['ACTIVE','HEALTHY','UNKNOWN'].includes(row.injury.status));
    return freeze({players:evidence.length,preGame:count(GAME_STATE.PRE_GAME),live:count(GAME_STATE.LIVE),final:count(GAME_STATE.FINAL),lockedUnknown:count(GAME_STATE.LOCKED_UNKNOWN),unknown:count(GAME_STATE.UNKNOWN),actionable:unlocked.length,injuryConcerns:injuries.length,nextKickoff:unlocked.map(row=>row.game.kickoff).filter(Boolean).sort()[0]||null,projectionCoverage:evidence.length?evidence.filter(row=>row.projection.supported).length/evidence.length:0});
  }
  function weeklyRead(summary,userOutlook,opponentOutlook){
    const sentences=[];
    if(summary.live)sentences.push(`${summary.live} roster player${summary.live===1?' is':'s are'} currently playing and locked.`);
    if(summary.final)sentences.push(`${summary.final} roster player${summary.final===1?' has':'s have'} completed; authoritative actual points replace projections.`);
    if(summary.injuryConcerns)sentences.push(`${summary.injuryConcerns} current injury designation${summary.injuryConcerns===1?' requires':'s require'} attention before the remaining lineup locks.`);
    if(summary.actionable)sentences.push(`${summary.actionable} roster decision${summary.actionable===1?' remains':'s remain'} changeable.`);
    if(userOutlook?.status==='AVAILABLE'&&opponentOutlook?.status==='AVAILABLE'){const margin=userOutlook.value-opponentOutlook.value;sentences.push(`Fantasy HQ Current Outlook is ${Math.abs(margin).toFixed(1)} points ${margin>=0?'ahead':'behind'}, using actual points for completed starters and current projections only for unstarted starters.`);}else sentences.push('Fantasy HQ Current Outlook remains unavailable because at least one starter lacks a safe current component.');
    return freeze({supported:Boolean(sentences.length),text:sentences.slice(0,3).join(' '),sentences:freeze(sentences),source:'CURRENT_WEEK_EVIDENCE'});
  }
  function build({model,evidenceStore=null,injurySnapshot=null,now=Date.now()}={}){
    const liveWeek=LiveWeek?.normalize(model?.snapshot?.liveWeek,{now})||null,context={season:model?.snapshot?.league?.season||model?.snapshot?.season||new Date(now).getUTCFullYear(),week:model?.week,scoringFormat:model?.scoring,provider:model?.snapshot?.provider,fetchedAt:model?.snapshot?.fetchedAt,now,demo:model?.demo===true,evidenceStore,injuries:injuryIndex(injurySnapshot),liveWeek},enrich=(player,scope)=>enrichPlayer(player,{...context,scope}),roster=freeze((model?.roster||[]).map(player=>enrich(player,'USER_ROSTER'))),opponentRoster=freeze((model?.opponent?.roster||[]).map(player=>enrich(player,'OPPONENT_ROSTER'))),available=freeze((model?.available||[]).map(player=>enrich(player,'AVAILABLE'))),indexPlayers=list=>{const index=new Map();list.forEach(player=>{const primary=lineupKey(player),source=clean(player?.sourcePlayerKey||player?.yahooPlayerKey||player?.yahooPlayerId);if(primary)index.set(primary,player);if(source)index.set(`source:${source}`,player)});return index},rosterIndex=indexPlayers(roster),opponentIndex=indexPlayers(opponentRoster),lineup=remapLineup(model?.lineup,rosterIndex),opponentLineup=remapLineup(model?.opponentLineup,opponentIndex),userOutlook=outlook(lineup),opponentOutlook=outlook(opponentLineup),summary=summarize(roster),read=weeklyRead(summary,userOutlook,opponentOutlook);
    return freeze({...model,roster,lineup,available,opponent:model?.opponent?freeze({...model.opponent,roster:opponentRoster}):model?.opponent,opponentLineup,currentWeekEvidence:freeze({schema:SCHEMA,sourceAuthority:model?.snapshot?.provider==='Yahoo'?'YAHOO_AUTHORITATIVE':model?.demo?'DEMO':'UNKNOWN',season:context.season,week:context.week,fetchedAt:iso(context.fetchedAt),schedule:liveWeek?freeze({status:liveWeek.status,provider:liveWeek.provider,fetchedAt:liveWeek.fetchedAt,games:liveWeek.games.length,reason:liveWeek.reason}):freeze({status:'UNAVAILABLE',provider:'nflverse',fetchedAt:null,games:0,reason:'SCHEDULE_ADAPTER_UNAVAILABLE'}),summary,userOutlook,opponentOutlook,weeklyRead:read,recommendationAuthority:false})});
  }
  return freeze({SCHEMA,GAME_STATE,FRESHNESS,THRESHOLDS,finite,normalizeFormat,freshness,identity,projection,game,availability,injury,trend,usage,enrichPlayer,outlook,summarize,weeklyRead,build});
});
