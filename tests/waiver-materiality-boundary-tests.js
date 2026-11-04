'use strict';
// Deterministic synthetic data only. No provider requests or real league records.
const assert=require('node:assert/strict');
const Waiver=require('../js/waiver-intelligence-v1');
const Weekly=require('../js/weekly-command-center-v1');
const now=Date.parse('2026-10-03T12:00:00Z'),stamp=new Date(now).toISOString();
function fixture() {
  const player = (id, value, slot) => ({name:id,position:'RB',canonicalPlayerId:id,yahooPlayerId:id,sourcePlayerKey:`461.p.${id}`,rosterSlot:slot,eligiblePositions:['RB','FLEX'],identity:{status:'MATCHED',canonicalPlayerId:id},projectionProvenance:{canonicalPlayerId:id,season:2026,week:4,recommendationAuthority:true,scoringCompatibility:{status:'EXACT'}},availabilityState:{actionable:true},currentWeek:{identity:{safe:true,canonicalPlayerId:id},season:2026,week:4,projection:{supported:true,value,week:4,source:'FANTASY_HQ_PROJECTION',scoringFormat:'HALF_PPR',projectionType:'CUSTOM_SCORING',freshness:'CURRENT',fetchedAt:stamp},game:{state:'PRE_GAME',actionable:true,locked:false,updatedAt:stamp,kickoff:'2026-10-04T17:00:00Z'},injury:{status:'UNKNOWN',rawStatus:'UNKNOWN'}}});
  const candidate=player('101',12,'BN'),bench=player('202',8,'BN');
  const model={profileId:'profile',week:4,scoring:'HALF_PPR',userTeamResolution:{status:'RESOLVED',teamKey:'461.l.1.t.1'},available:[candidate],roster:[bench],snapshot:{provider:'Yahoo',profileId:'profile',fetchedAt:stamp,league:{leagueKey:'461.l.1',season:2026,currentWeek:4},userTeamKey:'461.l.1.t.1',datasets:{players:{status:'CURRENT'}},availablePlayers:[candidate],teams:[{roster:[bench]}],currentRoster:{yahooTeamKey:'461.l.1.t.1',yahooLeagueKey:'461.l.1',roster:[{canonicalPlayerId:'202',yahooPlayerId:'202',yahooPlayerKey:'461.p.202',rosterSlot:'BN'}]},ownership:{valid:true,ownership:{'101':{status:'FREE_AGENT',teamKey:null,sourcePlayerId:'101'},'202':{status:'ROSTERED_BY_USER',teamKey:'461.l.1.t.1',sourcePlayerId:'202'}}}}};
  return {model,profile:{id:'profile'},horizon:'CURRENT_WEEK',now};
}

let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
function benefit(edge,baseline,need=false){return Waiver.weeklyBenefit({candidate:{position:'RB',injuryStatus:'ACTIVE',byeWeek:9},difference:edge,rosterProjection:{value:baseline}},{week:4,roster:need?[{position:'RB',rosterSlot:'RB',injuryStatus:'OUT'}]:[]}).classification;}
const cases=[
 ['WATCH absolute below',1.999,5,false,'NO ACTION'],['WATCH absolute exact',2,5,false,'WATCHLIST'],['WATCH absolute above',2.001,5,false,'WATCHLIST'],
 ['WATCH percent below',3.999,20,false,'NO ACTION'],['WATCH percent exact',4,20,false,'WATCHLIST'],['WATCH percent above',4.001,20,false,'WATCHLIST'],
 ['absolute passes percent fails',3,20,false,'NO ACTION'],['percent passes absolute fails',1.9,5,false,'NO ACTION'],
 ['PRIORITY absolute below',3.999,10,true,'WATCHLIST'],['PRIORITY absolute exact',4,10,true,'PRIORITY TARGET'],['PRIORITY absolute above',4.001,10,true,'PRIORITY TARGET'],
 ['PRIORITY percent below',5.999,20,true,'WATCHLIST'],['PRIORITY percent exact',6,20,true,'PRIORITY TARGET'],['PRIORITY percent above',6.001,20,true,'PRIORITY TARGET'],
 ['both strong gates without need',6,20,false,'WATCHLIST'],['both strong gates with need',6,20,true,'PRIORITY TARGET'],
 ['strong percent alone cannot promote',3.9,5,true,'WATCHLIST'],['strong absolute alone cannot promote',4,20,true,'WATCHLIST']
];
for(const [name,edge,base,need,expected] of cases)test(name,()=>assert.equal(benefit(edge,base,need),expected));
for(const value of [null,undefined,'','invalid',NaN,Infinity])test('production rejects baseline '+String(value),()=>{const f=fixture();f.model.roster[0].currentWeek.projection.value=value;assert.equal(Waiver.evaluate(f).comparisons.length,0);});
for(const value of [0,-1])test('verified finite baseline '+value+' preserves source but withholds materiality',()=>{const f=fixture();f.model.roster[0].currentWeek.projection.value=value;const c=Waiver.evaluate(f).comparisons[0];assert.equal(c.rosterProjection.value,value);assert.equal(c.difference,12-value);assert.equal(c.benefit.classification,'NO ACTION');assert.notEqual(c.action,'ADD');});
for(const value of [null,undefined,'',NaN])test('missing candidate projection '+String(value)+' cannot invent edge',()=>{const f=fixture();f.model.available[0].currentWeek.projection.value=value;assert.equal(Waiver.evaluate(f).comparisons.length,0);});
const pair=(id,edge,priority=1,bench='202')=>({candidate:{id,canonicalPlayerId:id,name:id,position:'RB'},rosterPlayer:{id:bench,name:bench},action:'WATCH',difference:edge,benefit:{priority,classification:priority===2?'PRIORITY TARGET':'WATCHLIST'},candidateProjection:{source:'SYNTHETIC',fetchedAt:stamp},yahooStatus:'FREE_AGENT',reason:'Synthetic comparison; no transaction authority.'});
const order=rows=>Weekly.waiverItems({waiver:{horizon:'CURRENT_WEEK',comparisons:rows}});
test('strongest eligible bench is smallest edge per candidate',()=>{const a=order([pair('a',8,1,'weak'),pair('a',3,1,'strong')]);assert.match(a[0].id,/strong$/);});
test('priority precedes watch even with smaller edge',()=>assert.deepEqual(order([pair('watch',10),pair('priority',4,2)]).map(x=>x.playerId),['priority','watch']));
test('same classification sorts descending edge',()=>assert.deepEqual(order([pair('a',2),pair('b',3)]).map(x=>x.playerId),['b','a']));
test('equal ties deterministically retain input order',()=>{for(let i=0;i<3;i++)assert.deepEqual(order([pair('a',3),pair('b',3)]).map(x=>x.playerId),['a','b']);});
function addCandidate(f,id,value){const p=structuredClone(f.model.available[0]);Object.assign(p,{name:id,canonicalPlayerId:id,yahooPlayerId:id,sourcePlayerKey:'461.p.'+id,identity:{status:'MATCHED',canonicalPlayerId:id}});p.currentWeek.identity.canonicalPlayerId=id;p.projectionProvenance.canonicalPlayerId=id;p.currentWeek.projection.value=value;f.model.available.push(p);f.model.snapshot.ownership.ownership[id]={status:'FREE_AGENT',teamKey:null,sourcePlayerId:id};return p;}
for(const [name,change] of [['unverified identity',p=>p.identity.status='UNRESOLVED'],['unsupported projection',p=>p.currentWeek.projection.supported=false],['locked',p=>p.currentWeek.game.locked=true],['ineligible',p=>p.eligiblePositions=[]]])test(name+' large apparent edge cannot outrank valid candidate',()=>{const f=fixture();change(addCandidate(f,'999',100));const rows=order(Waiver.evaluate(f).comparisons);assert.equal(rows.length,1);assert.equal(rows[0].playerId,'101');assert.equal(rows[0].actionSupported,false);});
test('locked bench yields no comparison',()=>{const f=fixture();f.model.roster[0].currentWeek.game.locked=true;assert.equal(Waiver.evaluate(f).comparisons.length,0);});
// Public helper contract: malformed input must not produce a materiality signal.
for(const value of [null,'',undefined,'   ','invalid',NaN,Infinity,0,-1,false,{}])test('weeklyBenefit missing baseline '+JSON.stringify(value)+' fails closed',()=>assert.equal(benefit(4,value,true),'NO ACTION'));
test('weeklyBenefit absent projection record fails closed',()=>assert.equal(Waiver.weeklyBenefit({candidate:{position:'RB'},difference:4},{roster:[]}).classification,'NO ACTION'));
for(const value of [null,undefined,'',NaN,Infinity,{}])test('invalid difference '+String(value)+' fails closed',()=>assert.equal(benefit(value,10,true),'NO ACTION'));
console.log(`${passed} passed; ${failed} failed`);process.exitCode=failed?1:0;
