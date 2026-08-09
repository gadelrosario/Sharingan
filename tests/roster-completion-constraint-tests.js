const C = require('../js/roster-completion-constraint-v1.js');
let passed = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const test = (name, fn) => { fn(); passed += 1; console.log(`✓ ${name}`); };
const player = (id, pos) => ({ id, name: `${pos} ${id}`, pos });
const pool = [player(1,'RB'),player(2,'WR'),player(3,'QB'),player(4,'TE'),player(5,'DST'),player(6,'K'),player(7,'DEF'),player(8,'RB')];
const row = (slot, filled = false) => ({ slot, kind: C.slotKind(slot), player: filled ? player(`filled-${slot}`, C.slotKind(slot)) : null });
function state(openSlots, picksRemaining, availablePlayers = pool) {
  return C.buildState({
    rosterState: { starters: openSlots.map(slot => row(slot)) },
    availablePlayers,
    currentPick: 1,
    totalPicks: picksRemaining,
    userTeam: 10,
    teamForPick: () => 10,
  });
}

test('two picks remaining with DST and K open hard-restricts to both required positions', () => {
  const current = state(['DEF','K'],2), constrained = C.constrainPool(pool,current);
  assert(current.hard && current.userPicksRemaining===2,'hard state missing');
  assert(constrained.every(candidate=>['DST','K'].includes(C.normalizePosition(candidate.pos))),'optional candidate leaked');
  assert(constrained.some(candidate=>C.normalizePosition(candidate.pos)==='DST')&&constrained.some(candidate=>candidate.pos==='K'),'required position missing');
  const cards=C.finalizeRecommendations(constrained,current,5);
  assert(C.normalizePosition(cards[0].pos)==='DST'&&cards[1].pos==='K','hard recommendations did not surface both positions');
});
test('one pick remaining with DST open permits only defense variants',()=>{
  const constrained=C.constrainPool(pool,state(['DST'],1));
  assert(constrained.length===2&&constrained.every(candidate=>C.normalizePosition(candidate.pos)==='DST'),'DST restriction failed');
});
test('one pick remaining with K open permits only kickers',()=>{
  const constrained=C.constrainPool(pool,state(['K'],1));
  assert(constrained.length===1&&constrained[0].pos==='K','K restriction failed');
});
test('three picks remaining with DST and K open preserves score order with one safe flexible choice',()=>{
  const current=state(['DEF','K'],3), ordered=[pool[0],pool[1],pool[4],pool[5],pool[2]], recommendations=C.finalizeRecommendations(ordered,current,5);
  assert(current.pressure,'pressure state missing');
  assert(recommendations[0].id===pool[0].id&&recommendations[1].id===pool[1].id,'soft completion silently reordered higher scores');
  assert(recommendations.some(candidate=>candidate.pos==='RB'),'safe flexible choice removed');
  assert(recommendations.some(candidate=>C.normalizePosition(candidate.pos)==='DST')&&recommendations.some(candidate=>candidate.pos==='K'),'required options disappeared');
});
test('completed required slots preserve normal recommendations',()=>{
  const current=state([],2),ordered=[pool[0],pool[1],pool[2]];
  assert(current.mode==='NORMAL'&&C.finalizeRecommendations(ordered,current,5)[0].id===1,'normal ordering changed');
});
test('category input list obeys the same mandatory candidate restriction',()=>{
  const current=state(['DEF','K'],2),cards=C.finalizeRecommendations(C.constrainPool(pool,current),current,5);
  assert(cards.every(candidate=>['DST','K'].includes(C.normalizePosition(candidate.pos))),'category card input bypassed restriction');
});
test('undo and refresh deterministically reopen the same required slot',()=>{
  const complete=state([],1),undone=state(['DEF'],1),refreshed=state(['DEF'],1);
  assert(complete.mode==='NORMAL'&&undone.hard,'undo did not reactivate');
  assert(JSON.stringify(undone.requiredPositions)===JSON.stringify(refreshed.requiredPositions)&&undone.message===refreshed.message,'refresh changed constraint');
});
test('DST, DEF, D/ST, and Defense normalize to one canonical position',()=>{
  assert(['DST','DEF','D/ST','Defense'].every(value=>C.normalizePosition(value)==='DST'),'defense normalization mismatch');
});
test('legitimately superior RB remains available when completion is safe',()=>{
  const current=state(['DEF','K'],4),ordered=[pool[0],pool[4],pool[5]];
  assert(current.mode==='NORMAL'&&C.finalizeRecommendations(ordered,current,5)[0].pos==='RB','normal RB value was forced out');
});
test('impossible completion reports state and still restricts to required positions',()=>{
  const current=state(['QB','DEF','K'],2),constrained=C.constrainPool(pool,current);
  assert(current.impossible&&current.message.includes('no longer mathematically possible'),'impossible state not reported');
  assert(constrained.every(candidate=>['QB','DST','K'].includes(C.normalizePosition(candidate.pos))),'impossible state leaked optional player');
});

console.log(`Roster completion deterministic tests: ${passed}/${passed} passed`);
