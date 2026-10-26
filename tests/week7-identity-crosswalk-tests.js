'use strict';
const assert=require('node:assert/strict');
const Y=require('../js/yahoo-season-v1'),R=require('../js/season-player-registry-v1');
const players=require('../data/players.json'),artifact=require('../data/season_evidence/season_player_registry.json');
const registry=new R.SeasonPlayerRegistry({canonicalPlayers:players,artifact}),all=[...players,...registry.evidencePlayers()],index=Y.buildCanonicalIndex(all);
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
for(const [yahoo,sleeper,gsis,id,position] of [['34357','8122','00-0037157','fhq_season_gsis_00_0037157','RB'],['30994','4983','00-0034827','61','WR']]){
 test(`${yahoo} resolves by corroborated stable ID despite display-name differences`,()=>{const source={yahooPlayerId:yahoo,name:'provider display alias',position};const identity=Y.reconcilePlayer(source,index);assert.equal(identity.canonicalPlayerId,id);assert.equal(identity.reason,'stable-yahoo-id');const rows=all.filter(p=>p.externalIds?.yahoo===yahoo);assert.equal(rows.length,1);assert.equal(rows[0].externalIds.sleeper,sleeper);assert.equal(rows[0].externalIds.gsis,gsis);});
 test(`${yahoo} duplicate provider ID remains quarantined`,()=>{const collision=Y.buildCanonicalIndex([...all,{id:'collision',name:'Other player',pos:position,externalIds:{yahoo}}]);assert.equal(Y.reconcilePlayer({yahooPlayerId:yahoo},collision).status,'AMBIGUOUS');});
 test(`${yahoo} conflicting canonical identity remains quarantined`,()=>{const collision=Y.buildCanonicalIndex([...all,{id,name:'Different identity',pos:position}]);assert.equal(Y.reconcilePlayer({yahooPlayerId:yahoo},collision).status,'AMBIGUOUS');});
}
test('unknown provider identity stays unresolved',()=>assert.equal(Y.reconcilePlayer({yahooPlayerId:'unknown',name:'Unknown',position:'RB'},index).status,'UNRESOLVED'));
test('Knight identity adds no draft or recommendation authority',()=>{const p=registry.get('fhq_season_gsis_00_0037157');assert.equal(p.draftEligible,false);assert.equal(p.recommendationEligible,false);assert.equal(p.draftUniverseMember,false);});
test('crosswalks are unique across application identities',()=>{assert.equal(index.canonicalConflicts.size,0);for(const id of ['34357','30994'])assert.equal(index.byYahoo.get(id).length,1);});
console.log(`${count}/${count} passed`);
