const FlightControlTests=(()=>{
  'use strict';
  const tests=[];
  const test=(name,fn)=>tests.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  const complete={
    hero:{playerId:7,name:'Brock Bowers',identity:'TE • LV',confidence:91,primary:{label:'Tier Cliff',reason:'Last elite TE available.'}},
    vision:{opportunity:{label:'Draft Now',reason:'The tier closes before your next pick.'},availability:{label:'Unlikely Available',reason:'Several teams can select a TE.'},tierCliff:{available:true,nearCliff:true,currentTier:'S',remainingInTier:0},userNeed:{position:'TE',status:'Starter need',starterNeed:true,count:0},whyNow:[{label:'Team fit',text:'Completes the starting lineup.'}],whyNot:{preferred:'The alternative has less positional leverage.'}},
    insight:{opportunityWindow:{label:'Draft now',reason:'Act at this pick.'}}
  };

  test('decision summary reduces existing signals to conclusions',()=>{
    const summary=window.FlightControlV1.decisionSummary({...complete,comparison:'Why not Bijan? Gibbs narrowly wins on tier scarcity.'});
    assert(summary.action==='DRAFT NOW','opportunity was not reduced to an action');
    assert(summary.reasons.length<=3,'too many decision bullets');
    assert(summary.reasons.includes('Last S-tier TE available.'),'tier conclusion missing');
    assert(summary.reasons.includes('Fills your TE1 slot.'),'roster conclusion missing');
    assert(!summary.reasons.includes('Unlikely to return next round.'),'wait conclusion was duplicated in Why');
    assert(summary.wait.action==='DRAFT NOW','wait action missing');
    assert(summary.wait.availability==='Unlikely Available','availability missing');
    assert(summary.wait.conclusion==='Unlikely to return next round.','wait conclusion missing');
    assert(summary.comparison.includes('Why not Bijan'),'comparison missing');
  });
  test('comparison summary uses the same decision model',()=>{
    const summary=window.FlightControlV1.decisionSummary({...complete,comparison:'Compared with Bijan.'});
    const card=window.FlightControlV1.comparisonSummary({hero:complete.hero,summary});
    assert(card.name==='Brock Bowers'&&card.action==='DRAFT NOW','comparison lost decision context');
    assert(card.confidence===91&&card.reason.length>0,'comparison hierarchy differs');
  });
  test('missing intelligence produces explicit neutral states',()=>{
    const summary=window.FlightControlV1.decisionSummary({hero:{primary:{}}});
    assert(summary.action==='LEAN DRAFT','missing opportunity did not use restrained action');
    assert(summary.reasons.length>0,'missing decision context was hidden');
    assert(summary.comparison==='Decision context is still developing.','missing comparison was hidden');
  });
  test('summary does not invent numeric probabilities',()=>{
    const summary=window.FlightControlV1.decisionSummary(complete);
    const text=JSON.stringify(summary);
    assert(!/%/.test(text),'decision conclusions invented a probability');
  });
  test('all supported opportunity states map to concise actions',()=>{
    const labels=['Draft Now','Risky To Wait','Probably Safe To Wait','Avoid'];
    const actions=labels.map(label=>window.FlightControlV1.actionLabel(label));
    assert(actions.join('|')==='DRAFT NOW|LEAN DRAFT|SAFE TO WAIT|AVOID','action mapping changed');
  });

  function run(){let passCount=0,failCount=0;for(const {name,fn} of tests){try{fn();console.log(`✓ ${name}`);passCount++}catch(error){console.error(`✗ ${name}: ${error.message}`);failCount++}}console.log(`Flight Control: ${passCount} passed, ${failCount} failed`);return{passCount,failCount,total:tests.length}}
  return{run};
})();
if(typeof window!=='undefined')window.FlightControlTests=FlightControlTests;
