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
test('pressure preserves one flex choice before required specialists lead',()=>{
  const constrained=turns.filter(turn=>turn.state.mode==='HARD');
  assert(constrained.every(turn=>turn.state.requiredPositions.includes(turn.cards[0]?.pos)),'required specialist did not lead a hard-constrained turn');
  const pressure=turns.filter(turn=>turn.state.mode==='PRESSURE');
  assert(pressure.every(turn=>turn.state.userPicksRemaining===turn.state.unfilledRequiredSlots+1),'pressure mode lost its one safe flexible selection');
  const last=turns.at(-1);
  assert(last.state.mode==='HARD'&&last.state.requiredPositions.includes(last.cards[0]?.pos),'final required selection escaped the hard boundary');
});
test('RB need and fit decline with adequate starters and bench depth',()=>{
  harness.configure({pick:81,userRoster:['Jahmyr Gibbs','Bijan Robinson','James Cook','Jonathan Taylor','Saquon Barkley','Omarion Hampton','Josh Allen','Trey McBride']});
  const deep=harness.completionSnapshot(),rb=deep.rawTop.find(candidate=>candidate.pos==='RB');
  assert(deep.rbBench>=2,'fixture did not create adequate RB bench depth');
  assert(rb&&rb.need===0,'RB positional need remained active');
  assert(rb.rosterFit<55&&rb.surplus<0,'existing RB surplus signal did not reduce engine fit');
});
test('full mock has no repeated RB-only rounds after adequate RB depth',()=>{
  const allRb=turns.filter(turn=>turn.state.mode==='NORMAL'&&turn.rbBench>=2&&turn.cards.length===5&&turn.cards.every(card=>card.pos==='RB'));
  const consecutive=allRb.filter((turn,index)=>index>0&&turns.indexOf(turn)-turns.indexOf(allRb[index-1])===1);
  assert(consecutive.length===0,`consecutive RB-only turns remained at ${consecutive.map(turn=>turn.pick).join(',')}`);
});
test('open WR starters retain positive need and nonzero roster fit',()=>{
  const turn=turns.find(item=>item.state.mode==='NORMAL'&&item.state.requiredPositions.includes('WR')),wr=turn?.rawTop.find(candidate=>candidate.pos==='WR');
  assert(wr&&wr.need>0&&wr.rosterFit>0,`WR state was need=${wr?.need}, fit=${wr?.rosterFit}`);
});

console.log(`Roster completion integration tests: ${passed}/${passed} passed`);
