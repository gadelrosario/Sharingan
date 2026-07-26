const FlightControlTests=(()=>{
  'use strict';
  const tests=[];
  const test=(name,fn)=>tests.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  const complete={
    hero:{playerId:7,name:'Brock Bowers',identity:'TE • LV',confidence:91,primary:{label:'Tier Cliff',reason:'Last elite TE available.'}},
    vision:{opportunity:{label:'Draft Now',reason:'The tier closes before your next pick.'},availability:{label:'Unlikely Available',reason:'Several teams can select a TE.'},tierCliff:{available:true,nearCliff:true,currentTier:'S',remainingInTier:0},userNeed:{position:'TE',status:'Starter need',starterNeed:true,count:0},whyNow:[{label:'Team fit',text:'Completes the starting lineup.'}],whyNot:{preferred:'The alternative has less positional leverage.'}},
    insight:{opportunityWindow:{label:'Draft now',reason:'Act at this pick.'},confidence:{score:91,label:'High confidence',reason:'clear 9-point lead'}}
  };

  test('decision summary reduces existing signals to conclusions',()=>{
    const summary=window.FlightControlV1.decisionSummary({...complete,comparison:'Why not Bijan? Gibbs narrowly wins on tier scarcity.'});
<<<<<<< HEAD
    assert(summary.action==='DRAFT NOW','opportunity was not reduced to an action');
=======
    assert(summary.action==='ACT','opportunity was not reduced to a tactical action');
>>>>>>> feature/flight-control-decision-surface
    assert(summary.reasons.length<=3,'too many decision bullets');
    assert(summary.reasons.includes('Last S-tier TE available.'),'tier conclusion missing');
    assert(summary.reasons.includes('Fills your TE1 slot.'),'roster conclusion missing');
    assert(!summary.reasons.includes('Unlikely to return next round.'),'wait conclusion was duplicated in Why');
    assert(summary.wait.action==='DRAFT NOW','wait action missing');
    assert(summary.wait.availability==='Unlikely Available','availability missing');
    assert(summary.wait.conclusion==='Unlikely to return next round.','wait conclusion missing');
    assert(summary.comparison.includes('Why not Bijan'),'comparison missing');
    assert(summary.comparison.includes('Gibbs narrowly wins'),'comparison explanation was truncated');
    assert(summary.confidence.score===91&&summary.confidence.label==='High Confidence','confidence presentation changed its score');
  });
  test('comparison summary uses the same decision model',()=>{
    const summary=window.FlightControlV1.decisionSummary({...complete,comparison:'Compared with Bijan.'});
    const card=window.FlightControlV1.comparisonSummary({hero:complete.hero,summary});
<<<<<<< HEAD
    assert(card.name==='Brock Bowers'&&card.action==='DRAFT NOW','comparison lost decision context');
=======
    assert(card.name==='Brock Bowers'&&card.action==='ACT','comparison lost decision context');
>>>>>>> feature/flight-control-decision-surface
    assert(card.confidence===91&&card.reason.length>0,'comparison hierarchy differs');
  });
  test('missing intelligence produces explicit neutral states',()=>{
    const summary=window.FlightControlV1.decisionSummary({hero:{primary:{}}});
<<<<<<< HEAD
    assert(summary.action==='LEAN DRAFT','missing opportunity did not use restrained action');
=======
    assert(summary.action==='ACT','missing opportunity did not use restrained action');
>>>>>>> feature/flight-control-decision-surface
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
  test('confidence presentation uses plain-language labels without changing the score',()=>{
    const cases=[[88,'High Confidence'],[70,'Solid Lean'],[50,'Close Call'],[35,'Very Close / Toss-Up']];
    cases.forEach(([score,label])=>{const result=window.FlightControlV1.confidencePresentation({score,reason:'only 1 point separates the top options'});assert(result.score===score&&result.label===label,`incorrect label for ${score}`)});
    assert(window.FlightControlV1.confidencePresentation({score:50,reason:'only 1 point separates the top options'}).note==='Top options are nearly equal.','close-call explanation missing');
  });
  test('duplicate opportunity and availability explanations appear only once',()=>{
    const repeated='One tier option remains before the next pick.';
    const summary=window.FlightControlV1.decisionSummary({...complete,vision:{...complete.vision,opportunity:{label:'Draft Now',reason:repeated},availability:{label:'Unlikely Available',reason:repeated}}});
    assert(summary.opportunity.reason===repeated,'opportunity explanation was removed');
    assert(summary.availability.reason==='','duplicate availability explanation remained');
  });
<<<<<<< HEAD

  function run(){let passCount=0,failCount=0;for(const {name,fn} of tests){try{fn();console.log(`✓ ${name}`);passCount++}catch(error){console.error(`✗ ${name}: ${error.message}`);failCount++}}console.log(`Flight Control: ${passCount} passed, ${failCount} failed`);return{passCount,failCount,total:tests.length}}
=======
  test('snake-board positions normalize to one reusable class mapping',()=>{
    const expected={WR:'board-pos-wr',RB:'board-pos-rb',TE:'board-pos-te',QB:'board-pos-qb',K:'board-pos-k',DST:'board-pos-dst','D/ST':'board-pos-dst',DEF:'board-pos-dst',Defense:'board-pos-dst',P:'board-pos-unknown','':'board-pos-unknown'};
    Object.entries(expected).forEach(([position,className])=>assert(window.FlightControlV1.boardPositionClass(position)===className,`${position||'blank'} mapped incorrectly`));
  });
  test('mission and best path consume existing state without ranking players',()=>{
    const pivot={id:8,name:'Bijan Robinson',identity:'RB • ATL',reason:'Strong alternative.'};
    const summary=window.FlightControlV1.decisionSummary({...complete,pivot,context:{round:4,strategy:'Balanced'}});
    assert(summary.mission==='Secure your TE before the current tier drops.','tier-cliff mission did not use forecast state');
    assert(summary.bestPath.label==='ACT'&&summary.bestPath.text.includes('Brock Bowers'),'best path did not use the recommended player');
    assert(summary.pivot.name==='Bijan Robinson','pivot was not exposed');
    assert(summary.strategy==='Balanced','strategy context was not preserved');
  });
  test('Eternal Mangekyo preserves historic falls and recognizes early elite falls',()=>{
    const active=window.FlightControlV1.eternalMangekyoActive;
    const check=(overall,pick,score,tier='S')=>active({tier,overall,pick,score});
    assert(!check(1,7,99),'overall #1 activated before a seven-pick fall');
    assert(check(1,8,85),'overall #1 did not activate at pick 8');
    assert(!check(2,8,99),'overall #2 activated before a seven-pick fall');
    assert(check(2,9,85),'overall #2 did not activate at pick 9');
    assert(!check(3,9,99),'overall #3 activated before a seven-pick fall');
    assert(check(3,10,85),'overall #3 did not activate at pick 10');
    assert(!check(1,10,84),'early elite fall ignored the score floor');
    assert(check(25,65,90),'historic 40-pick trigger regressed');
    assert(!check(25,65,89),'historic trigger ignored the score floor');
    assert(!check(1,10,99,'B'),'non-elite tier activated Eternal');
    [null,undefined,'','invalid',0,-1].forEach(overall=>assert(!check(overall,50,99),`invalid overall ${String(overall)} activated Eternal`));
  });

  function run(){let passCount=0,failCount=0;for(const {name,fn} of tests){try{fn();console.log(`✓ ${name}`);passCount++}catch(error){console.error(`✗ ${name}: ${error.message}`);failCount++}}console.log(`Fight Control: ${passCount} passed, ${failCount} failed`);return{passCount,failCount,total:tests.length}}
>>>>>>> feature/flight-control-decision-surface
  return{run};
})();
if(typeof window!=='undefined')window.FlightControlTests=FlightControlTests;
