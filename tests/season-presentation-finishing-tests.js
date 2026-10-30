'use strict';
const assert=require('node:assert/strict'),V=require('../js/season-home-v3');
let count=0;function test(name,fn){fn();console.log('PASS '+name);count++;}
test('ISO kickoff renders date, local time and zone',()=>{const label=V.kickoffLabel('2026-10-25T17:00:00Z',{timeZone:'America/Los_Angeles'});assert.match(label,/10:00/);assert.doesNotMatch(label,/T17:00/);assert.match(label,/Oct/);});
test('timezone changes presentation only',()=>{assert.match(V.kickoffLabel('2026-10-25T17:00:00Z',{timeZone:'America/New_York'}),/1:00/);});
test('TBD, invalid and missing kickoff handled',()=>{assert.equal(V.kickoffLabel('TBD'),'Kickoff TBD');for(const x of [null,'garbage','2026-99-88T17:00:00Z'])assert.equal(V.kickoffLabel(x),'Kickoff unavailable');});
test('unknown locked game does not invent live status',()=>{const game={state:'LOCKED_UNKNOWN',locked:true};assert.equal(V.gameLabel(game),'Lineup locked · game status unavailable');assert.equal(game.locked,true);});
test('final live bye have understandable labels',()=>{assert.equal(V.gameLabel({state:'FINAL'}),'Final');assert.equal(V.gameLabel({state:'LIVE'}),'Live');assert.equal(V.gameLabel({state:'BYE'}),'Bye week');});
test('unsupported and stale zero projections unavailable',()=>{assert.equal(V.matchupProjection({},0),null);assert.equal(V.matchupProjection({matchupComparison:{projectionStatus:'COMPLETE',narrativeAllowed:true},stale:true},0),null);});
test('verified zero is preserved while missing values are not coerced',()=>{const m={matchupComparison:{projectionStatus:'COMPLETE',narrativeAllowed:true}};assert.equal(V.matchupProjection(m,0),0);for(const v of [null,undefined,'',NaN])assert.equal(V.matchupProjection(m,v),null);assert.equal(V.matchupProjection(m,103.4),103.4);});
test('injury context requires current evidence and fresh model',()=>{const p={currentWeek:{injury:{current:true,status:'Q'}}};assert.equal(V.rosterContext(p),'Questionable · Review availability');assert.equal(V.rosterContext(p,{stale:true}),'');p.currentWeek.injury.current=false;assert.equal(V.rosterContext(p),'');});
test('no speculative matchup or lineup advice',()=>{assert.equal(V.rosterContext({name:'Player',projection:25}),'');assert.equal(V.rosterContext({currentWeek:{game:{state:'FINAL'}}}),'Final · Lineup locked');});
console.log(`${count}/${count} passed`);
