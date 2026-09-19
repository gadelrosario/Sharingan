'use strict';
const assert=require('assert');
const fixture=require('./fixtures/yahoo/live_shape_4_4_11_4.json');
const Yahoo=require('../js/yahoo-season-v1.js');
const Season=require('../js/season-command-center-v1.js');
const V3=require('../js/season-home-v3.js');

const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const snapshot=Yahoo.buildSeasonSnapshot(fixture.bundle,{profile:fixture.profile,canonicalPlayers:fixture.canonicalPlayers});
const model=Season.buildModel({state:{snapshot,sync:{status:'CURRENT',lastSuccessfulSyncAt:fixture.fetchedAt}},profile:fixture.profile,now:Date.parse(fixture.fetchedAt)});
const byName=name=>model.roster.find(player=>player.name===name);

test('1 current-week player projection survives Yahoo normalization',()=>assert.strictEqual(byName('User Receiver').projection,17.25));
test('2 projection survives canonical Season state',()=>assert.strictEqual(byName('User Receiver').projection,17.25));
test('3 numeric-string projection remains numeric',()=>assert.strictEqual(typeof byName('User Receiver').projection,'number'));
test('4 missing projection remains missing',()=>assert.strictEqual(Yahoo.normalizeYahooPlayer({player_id:'x',name:'Missing',display_position:'WR'}).projection,null));
test('5 valid zero projection remains zero',()=>assert.strictEqual(byName('User Runner').projection,0));
test('6 starter projections contribute to lineup total',()=>assert.strictEqual(Season.lineupProjection(model.lineup).value,17.25));
test('7 bench projections do not contribute to lineup total',()=>assert.notStrictEqual(Season.lineupProjection(model.lineup).value,67.25));
test('8 flexible starter slots contribute correctly',()=>assert.ok(model.lineup.starters.some(row=>row.slot==='FLEX'&&row.player?.name==='User Runner')));
test('9 opponent weekly projection remains mapped to opponent',()=>assert.strictEqual(model.matchupComparison.opponentWeeklyProjectedPoints,110.75));
test('10 user weekly projection remains mapped to user',()=>assert.strictEqual(model.matchupComparison.userWeeklyProjectedPoints,101.5));
test('11 live Weekly Read fails closed without authoritative current final',()=>{const read=V3.weeklyRead(model.matchupComparison,[]);assert.strictEqual(read.supported,false);assert.match(read.reason,/incomplete/)});
test('12 incomplete current projections block ahead-behind narrative',()=>{const c=Season.matchupComparison({facts:{supported:true,opponentTeamKey:'opp',userCurrentProjectedFinal:100,opponentCurrentProjectedFinal:null},freshness:'CURRENT'}),r=V3.weeklyRead(c,[]);assert.strictEqual(r.supported,false);assert.match(r.reason,/incomplete/)});
test('13 Position Battle uses authoritative starters',()=>{const rows=V3.positionBattle(model.lineup.starters,model.opponentLineup.starters);assert.strictEqual(rows.find(row=>row.position==='WR').userProjection,17.25)});
test('14 missing side prevents positional edge',()=>assert.strictEqual(V3.positionBattle(model.lineup.starters,[]).find(row=>row.position==='WR').state,'UNAVAILABLE'));
test('15 opponent and eligible-position metadata survive normalization',()=>{const player=byName('User Receiver');assert.strictEqual(player.opponent,'EEE');assert.deepStrictEqual(player.eligiblePositions,['WR','WRT'])});
test('16 injury status survives normalization',()=>assert.strictEqual(byName('User Receiver').injuryStatus,'Q'));
test('17 game time and state survive normalization',()=>{const player=byName('User Receiver');assert.strictEqual(player.gameStart,'2026-09-20T17:00:00Z');assert.strictEqual(player.gameStatus,'pregame')});
test('18 league scoring and roster configuration survive normalization',()=>{assert.strictEqual(snapshot.settings.scoringType,'half-ppr');assert.deepStrictEqual(snapshot.settings.rosterSlots,fixture.profile.settings.rosterSlots)});

let passCount=0;const failures=[];for(const [name,fn] of tests){try{fn();passCount++}catch(error){failures.push({name,error:error.stack||error.message})}}console.log(JSON.stringify({passCount,failCount:failures.length,failures}));if(failures.length)process.exit(1);
