(function(root){
  'use strict';
  const normalizePosition=value=>{const pos=String(value||'').trim().toUpperCase();return ['DEF','DEFENSE','D/ST'].includes(pos)?'DST':pos};
  const normalizeName=value=>String(value||'').toLowerCase().replace(/[.’'`-]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const key=(name,position)=>`${normalizeName(name)}|${normalizePosition(position)}`;
  function validate(snapshot){
    const errors=[],records=Array.isArray(snapshot?.records)?snapshot.records:[];
    if(snapshot?.source!=='Fantasyland'||snapshot?.hostPlatform!=='Flock Fantasy')errors.push('Unexpected specialist source.');
    if(snapshot?.snapshotDate!=='2026-08-09')errors.push('Unexpected specialist snapshot date.');
    if(snapshot?.rankingScope!=='position-only')errors.push('Specialist rankings must be position-only.');
    for(const position of ['K','DST']){
      const ranks=records.filter(row=>normalizePosition(row.position)===position).map(row=>Number(row.positionRank));
      const expected=position==='K'?30:32;
      if(ranks.length!==expected||ranks.some((rank,index)=>rank!==index+1))errors.push(`${position} ranks must be contiguous 1-${expected}.`);
    }
    if(new Set(records.map(row=>key(row.name,row.position))).size!==records.length)errors.push('Duplicate specialist identity.');
    return Object.freeze(errors);
  }
  function apply(players,snapshot){
    const errors=validate(snapshot);if(errors.length)throw new Error(errors.join(' '));
    const byIdentity=new Map(players.map(player=>[key(player.name,player.pos),player])),matched=[],unmatched=[];
    snapshot.records.forEach(row=>{
      const player=byIdentity.get(key(row.name,row.position));
      if(!player){unmatched.push(Object.freeze({...row}));return;}
      Object.assign(player,{
        fantasylandSpecialistPositionRank:Number(row.positionRank),
        fantasylandSpecialistSourceTeam:row.sourceTeam??null,
        fantasylandSpecialistCanonicalTeam:player.team??null,
        fantasylandSpecialistSource:'Fantasyland',
        fantasylandSpecialistHostPlatform:'Flock Fantasy',
        fantasylandSpecialistSnapshotDate:snapshot.snapshotDate,
        fantasylandSpecialistRankingScope:'position-only',
        fantasylandSpecialistProvenance:snapshot.provenanceNote,
      });
      matched.push(Object.freeze({id:player.id,name:player.name,position:normalizePosition(player.pos),positionRank:Number(row.positionRank)}));
    });
    return Object.freeze({matched:Object.freeze(matched),unmatched:Object.freeze(unmatched),errors});
  }
  const positionRank=player=>{const value=Number(player?.fantasylandSpecialistPositionRank);return Number.isFinite(value)&&value>0?value:null};
  const api=Object.freeze({normalizePosition,normalizeName,validate,apply,positionRank});
  root.SpecialistRankingsV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
