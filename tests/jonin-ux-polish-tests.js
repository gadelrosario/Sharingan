const JoninUXPolishTests = (() => {
  'use strict';
  const tests=[];
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  const test=(name,fn)=>tests.push({name,fn});

  test('strategy remains cautious while the draft develops',()=>{
    const result=JoninUXPolish.inferStrategy({counts:{RB:1,WR:0},round:1,draftedCount:1});
    assert(result.name==='Balanced','early strategy should remain balanced');
    assert(result.confidence===57&&result.note==='Draft still developing.','developing confidence is not restrained');
  });
  test('strategy changes from Zero RB to Hero RB from existing counts',()=>{
    const zero=JoninUXPolish.inferStrategy({counts:{RB:0,WR:3},round:4,draftedCount:3});
    const hero=JoninUXPolish.inferStrategy({counts:{RB:1,WR:3},round:5,draftedCount:4});
    assert(zero.name==='Zero RB'&&hero.name==='Hero RB','strategy did not follow roster construction');
    assert(zero.confidence>=60&&hero.confidence>=60,'strategy confidence missing');
  });
  test('team build identifies filled and missing starter slots',()=>{
    const rows=JoninUXPolish.teamBuild({counts:{QB:1,RB:2,WR:1,TE:0},settings:{startQB:1,startRB:2,startWR:3,startTE:1,flex:2}});
    const byPosition=Object.fromEntries(rows.map(row=>[row.position,row]));
    assert(byPosition.QB.complete&&byPosition.RB.complete,'filled starters shown missing');
    assert(byPosition.WR.missing===2&&byPosition.TE.missing===1&&byPosition.FLEX.missing===2,'missing starters incorrect');
  });
  test('primary driver reuses tier, need, and score inputs in priority order',()=>{
    const tier=JoninUXPolish.primaryDriver({player:{name:'A',pos:'WR'},breakdown:{value:8},vision:{tierCliff:{nearCliff:true,reason:'Last tier option.'},userNeed:{starterNeed:true,reason:'WR needed.'}}});
    const need=JoninUXPolish.primaryDriver({player:{name:'A',pos:'WR'},breakdown:{value:8},vision:{tierCliff:{nearCliff:false},userNeed:{starterNeed:true,reason:'WR needed.'}}});
    const value=JoninUXPolish.primaryDriver({player:{name:'A',pos:'WR'},breakdown:{value:8,rosterFit:4,scarcity:3},vision:{tierCliff:{nearCliff:false},userNeed:{starterNeed:false}}});
    assert(tier.label==='Tier Cliff'&&need.label==='Roster Need'&&value.label==='Elite Value','primary-driver priority incorrect');
  });
  test('hero model updates player identity and preserves heuristic confidence',()=>{
    const insight={confidence:{score:82,label:'High confidence'}};
    const first=JoninUXPolish.hero({player:{id:1,name:'Christian Watson',pos:'WR',team:'GB'},insight,breakdown:{value:5},vision:{tierCliff:{nearCliff:false},userNeed:{starterNeed:false}}});
    const second=JoninUXPolish.hero({player:{id:2,name:'Lamar Jackson',pos:'QB',team:'BAL'},insight,breakdown:{rosterFit:4},vision:{tierCliff:{nearCliff:false},userNeed:{starterNeed:true,reason:'QB needed.'}}});
    assert(first.playerId!==second.playerId&&second.name==='Lamar Jackson','hero did not update with recommendation');
    assert(first.confidence===82&&first.identity==='WR • GB','hero confidence or identity changed');
  });

  function run(){let passCount=0,failCount=0;tests.forEach(({name,fn})=>{try{fn();console.log(`✓ ${name}`);passCount++}catch(error){console.error(`✗ ${name}: ${error.message}`);failCount++}});console.log(`Jonin UX Polish: ${passCount} passed, ${failCount} failed`);return{passCount,failCount,total:tests.length}}
  return{run};
})();
if(typeof window!=='undefined')window.JoninUXPolishTests=JoninUXPolishTests;
