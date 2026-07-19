const SharinganVisionTests = (() => {
  'use strict';
  const tests=[];
  const test=(name,fn)=>tests.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  const player=(id,name,pos,overall,tier)=>({id,name,pos,overall,overallTier:tier,team:'TST'});
  const primary=player(1,'Primary RB','RB',20,'A');
  const alternative=player(2,'Alternative WR','WR',22,'A');
  const pool=[primary,player(3,'Last A RB','RB',24,'A'),player(4,'First B RB','RB',31,'B'),player(5,'Second B RB','RB',38,'B'),alternative];
  const breakdown={projection:90,value:5,rosterFit:3,scarcity:2,risk:0,final:100};

  test('detects the end of a tier and next tier',()=>{
    const result=SharinganVisionV1.detectTierCliff({player:primary,availablePlayers:pool});
    assert(result.nearCliff,'tier cliff not detected');
    assert(result.currentTier==='A'&&result.nextTier==='B','tier transition incorrect');
    assert(result.remainingInTier===1,'same-tier depth incorrect');
  });
  test('detects active positional runs from recent picks',()=>{
    const recent=[player(10,'RB1','RB',1,'S'),player(11,'WR1','WR',2,'S'),player(12,'RB2','RB',3,'A'),player(13,'RB3','RB',4,'A'),player(14,'QB1','QB',5,'S'),player(15,'RB4','RB',6,'B')];
    const result=SharinganVisionV1.detectPositionalRun({position:'RB',recentPicks:recent});
    assert(result.active&&result.count===4&&result.state==='Active run','active run result incorrect');
  });
  test('opportunity window emits all three deterministic labels',()=>{
    const cases=[
      SharinganVisionV1.opportunityWindow({forecast:{label:'Unlikely Available',reason:'x'},tierCliff:{nearCliff:true},run:{active:true,count:4},teamNeeds:{starterNeeds:4}}),
      SharinganVisionV1.opportunityWindow({forecast:{label:'Uncertain',reason:'x'},tierCliff:{nearCliff:false},run:{active:false,count:2},teamNeeds:{starterNeeds:1}}),
      SharinganVisionV1.opportunityWindow({forecast:{label:'Very Likely Available',reason:'x'},tierCliff:{nearCliff:false},run:{active:false,count:0},teamNeeds:{starterNeeds:0}})
    ];
    assert(cases.map(item=>item.label).join('|')==='Draft Now|Risky To Wait|Probably Safe To Wait','opportunity labels incorrect');
    cases.forEach(item=>assert(item.reason.trim(),'opportunity reason missing'));
  });
  test('availability forecast maps real heuristic inputs to labels',()=>{
    const low=SharinganVisionV1.availabilityForecast({player:primary,availablePlayers:[primary,...pool,...pool.map((p,i)=>({...p,id:p.id+20+i,overall:(p.overall||20)+2}))],picksUntil:2,tierCliff:{nearCliff:false,remainingInTier:5},run:{active:false,count:0},teamNeeds:{starterNeeds:0}});
    const high=SharinganVisionV1.availabilityForecast({player:primary,availablePlayers:[primary,player(8,'B RB','RB',40,'B')],picksUntil:9,tierCliff:{nearCliff:true,remainingInTier:0},run:{active:true,count:4},teamNeeds:{starterNeeds:4}});
    assert(low.label==='Very Likely Available',`unexpected low-urgency label ${low.label}`);
    assert(high.label==='Unlikely Available',`unexpected high-urgency label ${high.label}`);
  });
  test('Why Now explains every requested current-state signal',()=>{
    const items=SharinganVisionV1.whyNow({player:primary,breakdown,tierCliff:{reason:'One A remains.'},run:{reason:'Four RBs selected.'},teamNeeds:{reason:'Three teams need RB.'}});
    assert(items.map(item=>item.label).join('|')==='Value|Scarcity|Tier cliff|Positional run|Roster needs','Why Now labels incorrect');
    assert(items.every(item=>item.text.trim()),'Why Now explanation missing');
    assert(items[0].text.includes('5')&&items[1].text.includes('2'),'existing score modifiers not used');
  });
  test('Why Not selects the strongest available alternative',()=>{
    const result=SharinganVisionV1.whyNot({recommended:primary,candidates:[{player:primary,finalScore:100,breakdown},{player:alternative,finalScore:96,breakdown:{...breakdown,projection:92,rosterFit:1,final:96}}]});
    assert(result.alternative.id===alternative.id,'alternative incorrect');
    assert(result.scoreDifference===4,'score difference incorrect');
    assert(result.alternativeStrength.includes('projection')&&result.alternativeWeakness.includes('roster fit'),'component comparison incorrect');
  });
  test('forecast is deterministic and does not mutate draft-state inputs',()=>{
    const input={player:primary,candidates:[{player:primary,finalScore:100,breakdown},{player:alternative,finalScore:96,breakdown:{...breakdown,final:96}}],breakdown,availablePlayers:pool,recentPicks:[alternative],teamsBeforeNext:[{team:2,counts:{QB:0,RB:1,WR:2,TE:0}}],picksUntil:6};
    const before=JSON.stringify(input),first=SharinganVisionV1.forecast(input),second=SharinganVisionV1.forecast(input);
    assert(JSON.stringify(first)===JSON.stringify(second),'forecast is not deterministic');
    assert(JSON.stringify(input)===before,'forecast mutated inputs');
  });

  function run(){let passCount=0,failCount=0;tests.forEach(({name,fn})=>{try{fn();console.log(`✓ ${name}`);passCount++}catch(error){console.error(`✗ ${name}: ${error.message}`);failCount++}});console.log(`Sharingan Vision: ${passCount} passed, ${failCount} failed`);return{passCount,failCount,total:tests.length}}
  return{run};
})();
if(typeof window!=='undefined')window.SharinganVisionTests=SharinganVisionTests;
