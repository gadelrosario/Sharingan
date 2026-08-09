(function(root){
  'use strict';
  const supported=new Set([8,10,12,14,16]);
  function leagueSize(value){const size=Number(value);if(!supported.has(size))throw new RangeError('League size must be 8, 10, 12, 14, or 16.');return size}
  function teamForPick(pick,size){const teams=leagueSize(size),selection=Math.max(1,Number(pick)||1),round=Math.ceil(selection/teams),within=(selection-1)%teams+1;return round%2?within:teams+1-within}
  function pickInfo({pick=1,size=10,userSlot=1,totalRounds=17}={}){const teams=leagueSize(size),selection=Math.max(1,Number(pick)||1),slot=Math.max(1,Math.min(teams,Number(userSlot)||1)),round=Math.ceil(selection/teams);let next=selection;while(next<=teams*totalRounds&&teamForPick(next,teams)!==slot)next+=1;let following=next+1;while(following<=teams*totalRounds&&teamForPick(following,teams)!==slot)following+=1;return{pick:selection,round,pickInRound:(selection-1)%teams+1,onClock:teamForPick(selection,teams),nextUserPick:next<=teams*totalRounds?next:null,picksUntilNext:next-selection,followingUserPick:following<=teams*totalRounds?following:null}}
  function remainingUserPicks({currentPick=1,size=10,userSlot=1,totalRounds=17}={}){const teams=leagueSize(size);let count=0;for(let pick=Number(currentPick);pick<=teams*totalRounds;pick+=1)if(teamForPick(pick,teams)===Number(userSlot))count+=1;return count}
  const api=Object.freeze({SUPPORTED_SIZES:Object.freeze([...supported]),leagueSize,teamForPick,pickInfo,remainingUserPicks});
  root.DraftMathV1=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
