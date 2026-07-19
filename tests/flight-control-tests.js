const FlightControlTests=(()=>{
  'use strict';
  const tests=[];
  const test=(name,fn)=>tests.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  const complete={
    hero:{playerId:7,name:'Brock Bowers',identity:'TE • LV',confidence:91,primary:{label:'Tier Cliff',reason:'Last elite TE available.'}},
    vision:{opportunity:{label:'Draft Now',reason:'The tier closes before your next pick.'},availability:{label:'Unlikely Available',reason:'Several teams can select a TE.'},whyNow:[{label:'Team fit',text:'Completes the starting lineup.'}],whyNot:{preferred:'The alternative has less positional leverage.'}},
    insight:{opportunityWindow:{label:'Draft now',reason:'Act at this pick.'}}
  };

  test('decision summary reduces existing signals to conclusions',()=>{
    const summary=window.FlightControlV1.decisionSummary(complete);
    assert(summary.opportunity.label==='Draft Now','opportunity label changed');
    assert(summary.primary.label==='Tier Cliff','primary driver changed');
    assert(summary.reasons.includes('Completes the starting lineup.'),'why-now signal missing');
    assert(summary.availability.label==='Unlikely Available','availability changed');
  });
  test('comparison summary uses the same decision model',()=>{
    const summary=window.FlightControlV1.decisionSummary(complete);
    const card=window.FlightControlV1.comparisonSummary({hero:complete.hero,summary});
    assert(card.name==='Brock Bowers'&&card.opportunity==='Draft Now','comparison lost decision context');
    assert(card.confidence===91&&card.reason==='Last elite TE available.','comparison hierarchy differs');
  });
  test('missing intelligence produces explicit neutral states',()=>{
    const summary=window.FlightControlV1.decisionSummary({hero:{primary:{}}});
    assert(summary.opportunity.label==='Decision context is still developing.','missing opportunity was hidden');
    assert(summary.availability.reason==='Decision context is still developing.','missing availability was hidden');
    assert(summary.whyNot==='Decision context is still developing.','missing comparison was hidden');
  });
  test('summary does not invent numeric probabilities',()=>{
    const summary=window.FlightControlV1.decisionSummary(complete);
    const text=JSON.stringify(summary);
    assert(!/%/.test(text),'decision conclusions invented a probability');
  });

  function run(){let passCount=0,failCount=0;for(const {name,fn} of tests){try{fn();console.log(`✓ ${name}`);passCount++}catch(error){console.error(`✗ ${name}: ${error.message}`);failCount++}}console.log(`Flight Control: ${passCount} passed, ${failCount} failed`);return{passCount,failCount,total:tests.length}}
  return{run};
})();
if(typeof window!=='undefined')window.FlightControlTests=FlightControlTests;
