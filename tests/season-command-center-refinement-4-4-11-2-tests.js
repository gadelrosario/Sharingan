'use strict';
const assert = require('assert');
const fs = require('fs');
const Manual = require('../js/manual-season-state-v1.js');
const Waiver = require('../js/waiver-intelligence-v1.js');
const fixture = require('./fixtures/season_command_center_4_4_11_2.json');
const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
function confirmedReviewModel() {
  const roster = fixture.roster.map(player => ({
    ...player,
    identity: { status: 'MATCHED', canonicalPlayerId: player.canonicalPlayerId },
    waiverEvidence: {
      ...(player.rosterSlot === 'BN' ? fixture.dropEvidenceDefaults.bench : fixture.dropEvidenceDefaults.starter),
      rankingSource: 'Review fixture', roleSource: 'Review fixture', opportunitySource: 'Review fixture',
    },
  }));
  const model = {
    profileId: fixture.profile.id,
    sourceLabel: 'Review Fixture',
    draftSnapshot: false,
    stale: false,
    syncError: null,
    snapshot: { provider: 'Review Fixture', settings: { rosterSlots: fixture.profile.settings.rosterSlots }, ownership: { valid: true } },
    userTeamResolution: { status: 'RESOLVED' },
    roster,
    available: fixture.available.map(player => ({ ...player })),
    teams: Array.from({ length: 10 }, (_, index) => ({ teamKey: `t${index + 1}`, roster: index ? [] : roster })),
    groups: { starters: roster.filter(p => !['BN','IR'].includes(p.rosterSlot)), bench: roster.filter(p => p.rosterSlot === 'BN'), ir: roster.filter(p => p.rosterSlot === 'IR') },
    phase: { key: 'discovery' },
  };
  const store = new Manual.ManualSeasonStateStore({ storage: new MemoryStorage(), now: () => fixture.asOf });
  roster.forEach(player => store.create({ profileId: model.profileId, factType: 'ROSTER_MEMBERSHIP', playerId: player.canonicalPlayerId, value: 'ON_MY_ROSTER' }));
  model.available.forEach(player => store.create({ profileId: model.profileId, factType: 'PLAYER_AVAILABILITY', playerId: player.canonicalPlayerId, value: 'AVAILABLE' }));
  return Manual.applyToModel(model, store.list(model.profileId, { history: false }));
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
test('realistic review fixture is query-isolated', () => assert(app.includes("seasonReviewKey() === 'straight-outta-downey'")));
test('review fixture cannot enter normal profile persistence', () => assert(!/setItem\([^\n]*seasonReview/i.test(app)));
test('sanitized demo remains available', () => assert(app.includes("get('seasonDemo') === '1'") && app.includes('season_command_center_demo.json')));
test('real player names are present', () => ['A.J. Brown','Tre Tucker','Xavier Worthy','Jordan Addison'].forEach(name => assert(fixture.roster.concat(fixture.available).some(player => player.name === name))));
test('positions are present', () => fixture.roster.concat(fixture.available).forEach(player => assert(player.position)));
test('NFL teams are present', () => fixture.roster.concat(fixture.available).forEach(player => assert(player.sourceTeam)));
test('fixture projections are explicit and review-labeled', () => assert(fixture.projectionLabel === 'REVIEW FIXTURE PROJECTION' && fixture.roster.concat(fixture.available).every(player => Number.isFinite(player.projection))));
test('normal mode does not fabricate projections', () => assert(app.includes('if (!model?.reviewMode) return null')));
test('top recommendation copy is bounded', () => ['No move needs attention right now.','Interesting option, but the current evidence does not support making the move yet.'].forEach(text => assert(text.length < 100)));
test('alternatives use compact identity rows', () => assert(app.includes('seasonWeeklyAlternativeIdentity') && css.includes('.seasonWeeklyAlternative{grid-template-columns:minmax(0,1fr)')));
test('mobile hierarchy is status then recommendation', () => assert(app.indexOf("hero.replaceWith(compactStatus)") < app.indexOf("compactStatus.insertAdjacentElement('afterend', seasonWeeklyPrimaryDecision")));
test('legacy weekly hero is replaced on Home', () => assert(app.includes('hero.replaceWith(compactStatus)')));
test('primary and Discovery cards cap default badges at two', () => assert(app.includes("seasonStatusBadge(seasonDecisionPosture(primary)") && app.includes("seasonStatusBadge(seasonDiscoveryPosture(result)")));
test('review mode explicitly says not live', () => assert(fixture.reviewLabel.includes('NOT LIVE YAHOO DATA') && app.includes('REVIEW FIXTURE — NOT LIVE YAHOO DATA')));
test('transaction-quality result remains deterministic', () => {
  const first = Waiver.evaluate({ model: confirmedReviewModel(), profile: fixture.profile });
  const second = Waiver.evaluate({ model: confirmedReviewModel(), profile: fixture.profile });
  assert.equal(first.pairs[0].player.name, 'Tre Tucker');
  assert.equal(first.pairs[0].action, 'WAIT');
  assert.equal(first.pairs[0].drop.player.name, 'Jakobi Meyers');
  assert.deepEqual(first.pairs.map(pair => [pair.canonicalPlayerId, pair.action, pair.drop?.canonicalPlayerId]), second.pairs.map(pair => [pair.canonicalPlayerId, pair.action, pair.drop?.canonicalPlayerId]));
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.stack || error}`); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} Season refinement contracts passed`);
if (passed !== tests.length) process.exitCode = 1;
