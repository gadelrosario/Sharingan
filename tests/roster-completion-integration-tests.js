const { createHarness } = require('./recommendation-baseline-harness.js');
let passed=0;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const test=(name,fn)=>{fn();passed+=1;console.log(`✓ ${name}`)};
const harness=createHarness({unified:true}),result=harness.runDeterministicMock(),turns=result.turns;

test('full deterministic mock fills every configured required starter',()=>{
  const open=result.finalState.starters.filter(row=>!row.player);
  assert(open.length===0,`open slots: ${open.map(row=>row.slot).join(',')}`);
  assert(result.roster.K===1&&result.roster.DST===1,'specialists missing at completion');
});
test('required specialists lead when mathematically constrained, then flexibility resumes',()=>{
  const constrained=turns.filter(turn=>['PRESSURE','HARD'].includes(turn.state.mode));
  assert(constrained.every(turn=>turn.state.requiredPositions.includes(turn.cards[0]?.pos)),'required specialist did not lead a constrained turn');
  const last=turns.at(-1);
  assert(last.state.unfilledRequiredSlots===0&&last.state.mode==='NORMAL','normal behavior did not resume');
});
test('RB need and fit decline with adequate starters and bench depth',()=>{
  harness.configure({pick:81,userRoster:['Jahmyr Gibbs','Bijan Robinson','James Cook','Jonathan Taylor','Saquon Barkley','Omarion Hampton','Josh Allen','Trey McBride']});
  const deep=harness.completionSnapshot(),rb=deep.rawTop.find(candidate=>candidate.pos==='RB');
  assert(deep.rbBench>=2,'fixture did not create adequate RB bench depth');
  assert(rb&&rb.need===0,'RB positional need remained active');
  assert(rb.rosterFit<55&&rb.surplus<0,'existing RB surplus signal did not reduce engine fit');
});
test('full mock has no repeated RB-only rounds from incomplete-roster averaging',()=>{
  const allRb=turns.filter(turn=>turn.state.mode==='NORMAL'&&turn.cards.length===5&&turn.cards.every(card=>card.pos==='RB'));
  assert(allRb.length===0,`RB-only turns remained at ${allRb.map(turn=>turn.pick).join(',')}`);
});
test('open WR starters retain positive need and nonzero roster fit',()=>{
  const turn=turns.find(item=>item.state.mode==='NORMAL'&&item.state.requiredPositions.includes('WR')),wr=turn?.rawTop.find(candidate=>candidate.pos==='WR');
  assert(wr&&wr.need>0&&wr.rosterFit>0,`WR state was need=${wr?.need}, fit=${wr?.rosterFit}`);
});

console.log(`Roster completion integration tests: ${passed}/${passed} passed`);
