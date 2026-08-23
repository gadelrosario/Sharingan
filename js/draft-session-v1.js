(function(root){
  'use strict';
  const STORAGE_KEY='fantasyHQ.activeDraft.v1',NOTE_KEY='fantasyHQ.scroll.v1',SCHEMA_VERSION=1,DRAFT_STATE_VERSION=1;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const validObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const positiveInteger=value=>Number.isInteger(Number(value))&&Number(value)>0;
  const teamForPick=(pick,teams)=>{const round=Math.ceil(pick/teams),within=((pick-1)%teams)+1;return round%2?within:teams+1-within};
  function validate(snapshot){
    if(!validObject(snapshot)||snapshot.schemaVersion!==SCHEMA_VERSION)throw new Error('Unsupported saved draft.');
    const stateVersion=snapshot.draftStateVersion??DRAFT_STATE_VERSION;
    if(stateVersion!==DRAFT_STATE_VERSION)throw new Error('Incompatible saved draft state.');
    if(!Array.isArray(snapshot.history)||!Array.isArray(snapshot.drafted))throw new Error('Saved draft is incomplete.');
    const ids=snapshot.history.map(entry=>String(entry.id)),picks=snapshot.history.map(entry=>Number(entry.pick));
    if(new Set(ids).size!==ids.length)throw new Error('Saved draft contains duplicate players.');
    if(new Set(picks).size!==picks.length||picks.some(value=>!Number.isInteger(value)||value<1))throw new Error('Saved draft contains invalid picks.');
    if(picks.some((value,index)=>value!==index+1))throw new Error('Saved draft contains skipped or shifted picks.');
    if(snapshot.drafted.map(String).join('|')!==ids.join('|'))throw new Error('Saved draft player order is inconsistent.');
    if(!['active','complete'].includes(snapshot.status||'active'))throw new Error('Saved draft has an invalid status.');
    if(snapshot.mode!=null&&!['practice','live','yahoo'].includes(snapshot.mode))throw new Error('Saved draft has an invalid mode.');
    const settings=validObject(snapshot.settings)?snapshot.settings:{},configuration=validObject(snapshot.leagueConfiguration)?snapshot.leagueConfiguration:{},teams=Number(configuration.teams??settings.teams),slot=Number(snapshot.slot),pick=Number(snapshot.pick),rounds=Number(configuration.totalRounds),totalPicks=Number(configuration.totalPicks);
    if(Number.isFinite(teams)){
      if(!positiveInteger(teams)||teams<2||teams>32)throw new Error('Saved draft has an invalid league size.');
      if(!positiveInteger(slot)||slot>teams)throw new Error('Saved draft has an invalid user slot.');
      snapshot.history.forEach(entry=>{if(Number(entry.team)!==teamForPick(Number(entry.pick),teams))throw new Error('Saved draft contains an invalid team-slot mapping.')});
      if(Number.isFinite(Number(configuration.teams))&&Number.isFinite(Number(settings.teams))&&Number(configuration.teams)!==Number(settings.teams))throw new Error('Saved draft league sizes disagree.');
      if(positiveInteger(rounds)&&positiveInteger(totalPicks)&&rounds*teams!==totalPicks)throw new Error('Saved draft round configuration is inconsistent.');
      if(Array.isArray(settings.rosterSlots)&&positiveInteger(rounds)&&settings.rosterSlots.length!==rounds)throw new Error('Saved draft roster configuration is inconsistent.');
      if(positiveInteger(totalPicks)&&picks.some(value=>value>totalPicks))throw new Error('Saved draft exceeds its configured length.');
      if(snapshot.currentPickOwner!=null&&positiveInteger(pick)&&(!positiveInteger(totalPicks)||pick<=totalPicks)&&Number(snapshot.currentPickOwner)!==teamForPick(pick,teams))throw new Error('Saved draft current owner is inconsistent.');
    }
    if(Number.isFinite(pick)&&pick!==picks.length+1)throw new Error('Saved draft current pick is inconsistent.');
    if(positiveInteger(totalPicks)&&snapshot.status==='complete'&&(picks.length!==totalPicks||pick!==totalPicks+1))throw new Error('Saved completed draft is incomplete.');
    if(positiveInteger(totalPicks)&&snapshot.status==='active'&&pick>totalPicks)throw new Error('Saved active draft is already complete.');
    if(positiveInteger(teams)&&Number.isFinite(snapshot.currentRound)&&Number(snapshot.currentRound)!==Math.ceil(Math.max(1,pick)/teams))throw new Error('Saved draft current round is inconsistent.');
    if(snapshot.leagueProfileId!=null&&!/^[a-z0-9][a-z0-9-]{1,63}$/i.test(String(snapshot.leagueProfileId)))throw new Error('Saved draft has an invalid league profile identity.');
    return clone({...snapshot,draftStateVersion:stateVersion});
  }
  function createSnapshot(state,existing=null){
    const now=new Date().toISOString(),history=clone(state.history||[]);
    return validate({schemaVersion:SCHEMA_VERSION,draftStateVersion:DRAFT_STATE_VERSION,sessionId:existing?.sessionId||`draft_${Date.now().toString(36)}`,createdAt:existing?.createdAt||now,updatedAt:now,status:state.status||'active',mode:state.mode,style:state.style,leagueProfileId:state.leagueProfileId??null,appVersion:state.appVersion??null,rankingSnapshot:clone(state.rankingSnapshot||null),injurySnapshot:clone(state.injurySnapshot||null),archiveRecordId:state.archiveRecordId??null,slot:state.slot,pick:state.pick,currentRound:state.currentRound,currentPickOwner:state.currentPickOwner,drafted:[...(state.drafted||[])],history,decisionSnapshots:clone(state.decisionSnapshots||[]),settings:clone(state.settings||{}),leagueConfiguration:clone(state.leagueConfiguration||{}),managers:clone(state.managers||{}),recommendations:clone(state.recommendations||[]),importedRankings:clone(state.importedRankings||[])});
  }
  class DraftSessionStore{
    constructor(storage=root.localStorage,key=STORAGE_KEY){this.storage=storage;this.key=String(key||STORAGE_KEY);}
    load(){const raw=this.storage?.getItem(this.key);if(!raw)return null;try{return validate(JSON.parse(raw));}catch(error){console.warn?.('Clearing invalid Fantasy HQ draft session:',error.message);this.clear();return null;}}
    hasActive(){return this.load()?.status==='active';}
    save(state){const current=this.load(),snapshot=createSnapshot(state,current?.status==='active'?current:null);this.storage?.setItem(this.key,JSON.stringify(snapshot));return snapshot;}
    start(state,{replace=false}={}){if(this.hasActive()&&!replace)throw new Error('An active draft already exists. Resume it or explicitly start a new draft.');this.clear();return this.save(state);}
    complete(state){const snapshot=this.save({...state,status:'complete'});return snapshot;}
    clear(){this.storage?.removeItem(this.key);}
  }
  function timeline(history=[],playerIndex=new Map(),leagueSize=10){
    const rounds=[],teams=Math.max(2,Number(leagueSize)||10);
    [...history].sort((a,b)=>a.pick-b.pick).forEach(entry=>{const round=Math.ceil(entry.pick/teams),player=playerIndex.get(String(entry.id))||playerIndex.get(Number(entry.id)),row={...entry,round,label:`${round}.${String(((entry.pick-1)%teams)+1).padStart(2,'0')}`,playerName:player?.name||'Unknown player'};let group=rounds.find(item=>item.round===round);if(!group){group={round,picks:[]};rounds.push(group)}group.picks.push(row)});
    return rounds;
  }
  function loadNote(storage=root.localStorage){return storage?.getItem(NOTE_KEY)||'';}
  function saveNote(value,storage=root.localStorage){storage?.setItem(NOTE_KEY,String(value??''));return String(value??'');}
  function noteReminders(value=''){
    const lines=String(value||'').split(/\r?\n/),reminders=[];
    for(let index=0;index<lines.length;index++){
      const match=lines[index].trim().match(/^Rounds?\s+(\d+)(?:\s*[–-]\s*(\d+))?\s*:\s*(.*)$/i);
      if(!match)continue;
      const start=Number(match[1]),end=Number(match[2]||match[1]),body=[];
      if(match[3])body.push(match[3]);
      for(let cursor=index+1;cursor<lines.length&&!/^Rounds?\s+\d+(?:\s*[–-]\s*\d+)?\s*:/i.test(lines[cursor].trim());cursor++)if(lines[cursor].trim())body.push(lines[cursor].trim());
      reminders.push({id:`round_${start}_${end}_${index}`,start,end,text:body.join(' ')});
    }
    return reminders;
  }
  function remindersForRound(value,round){return noteReminders(value).filter(item=>Number(round)>=item.start&&Number(round)<=item.end);}
  const api=Object.freeze({STORAGE_KEY,NOTE_KEY,SCHEMA_VERSION,DRAFT_STATE_VERSION,DraftSessionStore,createSnapshot,validate,timeline,teamForPick,loadNote,saveNote,noteReminders,remindersForRound});
  root.DraftSessionV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
