(function(global){
  'use strict';
  const VERSION='2.9.0';
  const STORAGE_KEY='fantasyHQ.leagueState.v1';
  const SCHEMA_VERSION=1;

  const clone=value=>JSON.parse(JSON.stringify(value));
  const now=()=>new Date().toISOString();
  const uid=(prefix='id')=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const normalizePos=pos=>String(pos||'').toUpperCase()==='DEF'?'DST':String(pos||'').toUpperCase();

  function createLeagueState(overrides={}){
    return {
      schemaVersion:SCHEMA_VERSION,
      id:overrides.id||'164770',
      name:overrides.name||'SQUAAA! ROYAL RUMBLE',
      season:overrides.season||2026,
      provider:overrides.provider||'local',
      sync:{status:'local',lastSyncedAt:null,lastAttemptAt:null,message:'Ready for snapshot import',providerLeagueId:overrides.id||'164770'},
      settings:{teams:10,scoring:'half',startWR:3,flex:2,passTD:6,rosterSlots:['QB','RB','RB','WR','WR','WR','TE','FLEX','FLEX','K','DST','BENCH','BENCH','BENCH','BENCH','BENCH','BENCH'],faab:false,...(overrides.settings||{})},
      teams:[],rosters:{},availablePlayerIds:[],transactions:[],matchups:[],standings:[],waivers:[],playerMeta:{},updatedAt:now(),
      ...overrides
    };
  }

  function validateLeagueState(input){
    if(!input||typeof input!=='object')throw new Error('Snapshot must be a JSON object.');
    const state=createLeagueState(input);
    if(!Array.isArray(state.teams))state.teams=[];
    if(!state.rosters||typeof state.rosters!=='object')state.rosters={};
    ['availablePlayerIds','transactions','matchups','standings','waivers'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
    state.schemaVersion=SCHEMA_VERSION;state.updatedAt=now();
    state.sync={...createLeagueState().sync,...(input.sync||{}),status:input.provider&&input.provider!=='local'?'synced':'local'};
    return state;
  }

  let state;
  try{state=validateLeagueState(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||createLeagueState())}
  catch(_){state=createLeagueState()}

  const listeners=new Set();
  function emit(reason='update'){listeners.forEach(fn=>{try{fn(clone(state),reason)}catch(err){console.warn('FantasyHQ listener failed',err)}})}
  function save(reason='save'){state.updatedAt=now();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));emit(reason);return clone(state)}
  function setState(next,reason='replace'){state=validateLeagueState(next);return save(reason)}
  function patchState(patch,reason='patch'){state=validateLeagueState({...state,...patch});return save(reason)}

  function calculateTeamStrength(playerIds=[],playerIndex=new Map()){
    const weights={QB:1.05,RB:1.18,WR:1.2,TE:1.08,K:.22,DST:.28};
    const positional={QB:[],RB:[],WR:[],TE:[],K:[],DST:[]};
    playerIds.map(id=>playerIndex.get(Number(id))||playerIndex.get(String(id))).filter(Boolean).forEach(p=>{const pos=normalizePos(p.pos);if(positional[pos])positional[pos].push(p)});
    Object.values(positional).forEach(arr=>arr.sort((a,b)=>(a.overall||999)-(b.overall||999)));
    let total=0,used=0;
    const starterCounts={QB:1,RB:2,WR:3,TE:1,K:1,DST:1};
    Object.entries(positional).forEach(([pos,arr])=>{
      const count=starterCounts[pos]||0;
      arr.slice(0,count).forEach((p,i)=>{const rank=Math.max(1,Number(p.overall)||250);total+=(110-Math.min(rank,100))*(weights[pos]||1)*(1-i*.08);used++});
      arr.slice(count).forEach((p,i)=>{const rank=Math.max(1,Number(p.overall)||250);total+=Math.max(0,85-Math.min(rank,120))*.18/(1+i*.2)});
    });
    const raw=used?total/(used*1.05):0;
    return Math.max(0,Math.min(100,Math.round((raw/100)*1000)/10));
  }

  function teamFit({addPlayer,dropPlayer,rosterIds=[],playerIndex=new Map(),needs={}}){
    if(!addPlayer)return {score:0,label:'Unavailable',reason:'No add candidate supplied.'};
    const addRank=Number(addPlayer.overall)||250,dropRank=dropPlayer?(Number(dropPlayer.overall)||250):300;
    const pos=normalizePos(addPlayer.pos),dropPos=dropPlayer?normalizePos(dropPlayer.pos):null;
    const rankGain=Math.max(-40,Math.min(60,dropRank-addRank));
    const needBoost=Number(needs[pos]||0)*12;
    const positionSwap=dropPos===pos?8:0;
    const score=Math.max(0,Math.min(100,Math.round(55+rankGain*.55+needBoost+positionSwap)));
    const reason=score>=90?`${addPlayer.name} is a major roster upgrade and fills a priority need.`:score>=75?`${addPlayer.name} improves rest-of-season value with a strong fit for this roster.`:score>=60?`${addPlayer.name} is a modest upgrade, but the move is not urgent.`:`The available upgrade is too small to justify the roster churn.`;
    return {score,label:score>=90?'Elite':score>=75?'Strong':score>=60?'Moderate':'Low',reason};
  }

  function simulateMove({rosterIds=[],addPlayer,dropPlayer,playerIndex=new Map(),needs={}}){
    const before=calculateTeamStrength(rosterIds,playerIndex);
    let next=[...rosterIds];
    if(dropPlayer)next=next.filter(id=>String(id)!==String(dropPlayer.id));
    if(addPlayer&&!next.some(id=>String(id)===String(addPlayer.id)))next.push(addPlayer.id);
    const after=calculateTeamStrength(next,playerIndex),fit=teamFit({addPlayer,dropPlayer,rosterIds,playerIndex,needs});
    const delta=Math.round((after-before)*10)/10;
    const confidence=Math.max(45,Math.min(99,Math.round(60+Math.abs(delta)*8+fit.score*.18)));
    return {before,after,delta,teamFit:fit.score,teamFitLabel:fit.label,confidence,recommendation:delta>1?'ADD':delta>=0?'LEAN ADD':'HOLD',oneLiner:fit.reason};
  }

  function exportSnapshot(){return JSON.stringify(state,null,2)}
  function importSnapshot(text){return setState(JSON.parse(text),'snapshot-import')}
  function recordTransaction(tx){state.transactions.unshift({id:uid('tx'),createdAt:now(),...tx});return save('transaction')}
  function updateDraftContext({settings,teams,rosters,availablePlayerIds,playerMeta}={}){
    state.settings={...state.settings,...(settings||{})};if(teams)state.teams=teams;if(rosters)state.rosters=rosters;if(availablePlayerIds)state.availablePlayerIds=availablePlayerIds;if(playerMeta)state.playerMeta=playerMeta;state.sync.message='Local draft state updated';return save('draft-context');
  }
  function markSyncAttempt(provider='yahoo'){state.sync={...state.sync,status:'pending',lastAttemptAt:now(),message:`${provider} connector requires a secure backend`};return save('sync-attempt')}

  global.FantasyHQCore={VERSION,SCHEMA_VERSION,getState:()=>clone(state),setState,patchState,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},exportSnapshot,importSnapshot,recordTransaction,updateDraftContext,markSyncAttempt,createLeagueState,validateLeagueState,calculateTeamStrength,teamFit,simulateMove};
})(window);
