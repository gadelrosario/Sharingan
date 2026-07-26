/** Pure, deterministic roster-slot assignment for the live My Team panel. */
const RosterViewV1=(()=>{
  'use strict';
  const FLEX_POSITIONS=new Set(['RB','WR','TE']);
  const normalizePosition=value=>{const pos=String(value||'').trim().toUpperCase();return pos==='DEF'||pos==='D/ST'||pos==='DEFENSE'?'DST':pos};
  const slotKind=slot=>{const value=String(slot||'').toUpperCase();if(value.startsWith('BENCH'))return'BENCH';if(value.startsWith('FLEX'))return'FLEX';if(value.startsWith('DEF')||value.startsWith('DST'))return'DST';for(const position of ['QB','RB','WR','TE','K'])if(value.startsWith(position))return position;return'UNKNOWN'};
  function assignSlots({slots=[],draftedEntries=[]}={}){
    const entries=draftedEntries.map((entry,index)=>({id:entry?.id??null,player:entry?.player||null,draftOrder:Number.isFinite(entry?.draftOrder)?entry.draftOrder:index,index,assigned:false})).sort((a,b)=>a.draftOrder-b.draftOrder||a.index-b.index);
    const rows=slots.map((slot,index)=>({slot,index,kind:slotKind(slot),player:null,playerId:null,unresolved:false}));
    const take=predicate=>{const entry=entries.find(candidate=>!candidate.assigned&&candidate.player&&predicate(normalizePosition(candidate.player.pos??candidate.player.position)));if(entry)entry.assigned=true;return entry||null};
    rows.filter(row=>!['FLEX','BENCH','UNKNOWN'].includes(row.kind)).forEach(row=>{const entry=take(position=>position===row.kind);if(entry){row.player=entry.player;row.playerId=entry.id}});
    rows.filter(row=>row.kind==='FLEX').forEach(row=>{const entry=take(position=>FLEX_POSITIONS.has(position));if(entry){row.player=entry.player;row.playerId=entry.id}});
    rows.filter(row=>row.kind==='BENCH').forEach(row=>{const entry=entries.find(candidate=>!candidate.assigned);if(entry){entry.assigned=true;row.player=entry.player;row.playerId=entry.id;row.unresolved=!entry.player}});
    const overflow=entries.filter(entry=>!entry.assigned).map(entry=>({slot:`OVERFLOW${entry.index+1}`,kind:'OVERFLOW',player:entry.player,playerId:entry.id,unresolved:!entry.player,draftOrder:entry.draftOrder}));
    const unresolved=[...rows,...overflow].filter(row=>row.unresolved);
    return {starters:rows.filter(row=>row.kind!=='BENCH'),bench:rows.filter(row=>row.kind==='BENCH'),overflow,unresolved,allRows:[...rows,...overflow]};
  }
  return {assignSlots,normalizePosition,slotKind,FLEX_POSITIONS:Object.freeze([...FLEX_POSITIONS])};
})();
if(typeof window!=='undefined')window.RosterViewV1=RosterViewV1;
if(typeof module!=='undefined'&&module.exports)module.exports=RosterViewV1;
