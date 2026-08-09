(function(root){
  'use strict';
  const STORAGE_KEY='fantasyHQ.activeDraft.v1',NOTE_KEY='fantasyHQ.scroll.v1',SCHEMA_VERSION=1;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const validObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  function validate(snapshot){
    if(!validObject(snapshot)||snapshot.schemaVersion!==SCHEMA_VERSION)throw new Error('Unsupported saved draft.');
    if(!Array.isArray(snapshot.history)||!Array.isArray(snapshot.drafted))throw new Error('Saved draft is incomplete.');
    const ids=snapshot.history.map(entry=>String(entry.id)),picks=snapshot.history.map(entry=>Number(entry.pick));
    if(new Set(ids).size!==ids.length)throw new Error('Saved draft contains duplicate players.');
    if(new Set(picks).size!==picks.length||picks.some(value=>!Number.isInteger(value)||value<1))throw new Error('Saved draft contains invalid picks.');
    return clone(snapshot);
  }
  function createSnapshot(state,existing=null){
    const now=new Date().toISOString(),history=clone(state.history||[]);
    return validate({schemaVersion:SCHEMA_VERSION,sessionId:existing?.sessionId||`draft_${Date.now().toString(36)}`,createdAt:existing?.createdAt||now,updatedAt:now,status:state.status||'active',mode:state.mode,style:state.style,slot:state.slot,pick:state.pick,drafted:[...(state.drafted||[])],history,decisionSnapshots:clone(state.decisionSnapshots||[]),settings:clone(state.settings||{}),leagueConfiguration:clone(state.leagueConfiguration||{}),managers:clone(state.managers||{}),recommendations:clone(state.recommendations||[]),importedRankings:clone(state.importedRankings||[])});
  }
  class DraftSessionStore{
    constructor(storage=root.localStorage){this.storage=storage;}
    load(){const raw=this.storage?.getItem(STORAGE_KEY);if(!raw)return null;try{return validate(JSON.parse(raw));}catch(error){console.warn?.('Ignoring invalid Fantasy HQ draft session:',error.message);return null;}}
    hasActive(){return this.load()?.status==='active';}
    save(state){const current=this.load(),snapshot=createSnapshot(state,current?.status==='active'?current:null);this.storage?.setItem(STORAGE_KEY,JSON.stringify(snapshot));return snapshot;}
    start(state,{replace=false}={}){if(this.hasActive()&&!replace)throw new Error('An active draft already exists. Resume it or explicitly start a new draft.');this.clear();return this.save(state);}
    complete(state){const snapshot=this.save({...state,status:'complete'});return snapshot;}
    clear(){this.storage?.removeItem(STORAGE_KEY);}
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
  const api=Object.freeze({STORAGE_KEY,NOTE_KEY,SCHEMA_VERSION,DraftSessionStore,createSnapshot,validate,timeline,loadNote,saveNote,noteReminders,remindersForRound});
  root.DraftSessionV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
