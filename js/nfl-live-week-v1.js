(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FantasyHQNflLiveWeekV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='fantasy-hq-nfl-live-week-1';
  const STATES=new Set(['PRE_GAME','LIVE','FINAL','LOCKED_UNKNOWN','POSTPONED','CANCELLED','UNKNOWN']);
  const TEAM_ALIASES=Object.freeze({JAC:'JAX',LA:'LAR',STL:'LAR',OAK:'LV',SD:'LAC',WSH:'WAS'});
  const clean=value=>String(value??'').trim();
  const team=value=>{const key=clean(value).toUpperCase().replace(/[^A-Z]/g,'');return TEAM_ALIASES[key]||key||null;};
  const iso=value=>{const stamp=Date.parse(value||'');return Number.isFinite(stamp)?new Date(stamp).toISOString():null;};
  const number=value=>value===null||value===undefined||clean(value)===''||!Number.isFinite(Number(value))?null:Number(value);
  const freeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(freeze);return Object.freeze(value);};
  function normalizeGame(row,now=Date.now()){
    const homeTeam=team(row?.homeTeam??row?.home_team),awayTeam=team(row?.awayTeam??row?.away_team),kickoff=iso(row?.kickoff),homeScore=number(row?.homeScore??row?.home_score),awayScore=number(row?.awayScore??row?.away_score),explicit=clean(row?.state).toUpperCase().replace(/[ -]+/g,'_'),kickoffMs=Date.parse(kickoff||''),scoresFinal=homeScore!==null&&awayScore!==null&&explicit==='FINAL';
    if(!clean(row?.gameId??row?.game_id)||!homeTeam||!awayTeam)return null;
    let state=STATES.has(explicit)?explicit:'UNKNOWN';
    if(scoresFinal)state='FINAL';
    else if(state==='PRE_GAME'&&Number.isFinite(kickoffMs)&&Number(now)>=kickoffMs)state='LOCKED_UNKNOWN';
    const locked=['LIVE','FINAL','LOCKED_UNKNOWN','CANCELLED'].includes(state),actionable=state==='PRE_GAME'&&!locked;
    return freeze({gameId:clean(row.gameId??row.game_id),season:number(row.season),week:number(row.week),homeTeam,awayTeam,kickoff,state,locked,actionable,homeScore,awayScore,source:'nflverse schedules'});
  }
  function normalize(payload,{now=Date.now()}={}){
    if(!payload||payload.schema!==SCHEMA||payload.provider!=='nflverse'||!Array.isArray(payload.games))return freeze({schema:SCHEMA,status:'UNAVAILABLE',provider:'nflverse',fetchedAt:null,season:null,week:null,games:freeze([]),reason:'UNSUPPORTED_OR_MISSING_SCHEDULE'});
    const games=payload.games.map(row=>normalizeGame(row,now)).filter(Boolean),fetchedAt=iso(payload.fetchedAt),status=games.length?'AVAILABLE':'UNAVAILABLE';
    return freeze({schema:SCHEMA,status,provider:'nflverse',source:clean(payload.source)||'nflverse schedules',sourceUrl:clean(payload.sourceUrl)||null,license:clean(payload.license)||null,fetchedAt,season:number(payload.season),week:number(payload.week),games:freeze(games),reason:games.length?null:'NO_VALID_GAMES',recommendationAuthority:false});
  }
  function teamGame(snapshot,teamValue){
    const key=team(teamValue);if(!key||snapshot?.status!=='AVAILABLE')return null;
    const matches=snapshot.games.filter(game=>game.homeTeam===key||game.awayTeam===key);
    if(matches.length!==1)return null;
    const game=matches[0],home=game.homeTeam===key;
    return freeze({...game,team:key,opponent:home?game.awayTeam:game.homeTeam,homeAway:home?'HOME':'AWAY',fetchedAt:snapshot.fetchedAt});
  }
  return freeze({SCHEMA,STATES:freeze([...STATES]),TEAM_ALIASES,team,normalizeGame,normalize,teamGame});
});
