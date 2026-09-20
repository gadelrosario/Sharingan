const assert = require('assert');
const fs = require('fs');
const LiveWeek = require('../js/nfl-live-week-v1.js');
const Current = require('../js/season-current-week-evidence-v1.js');
const Yahoo = require('../js/yahoo-season-v1.js');
const Sync = require('../js/yahoo-sync-v1.js');
const StartSit = require('../js/start-sit-intelligence-v1.js');
const Home = require('../js/season-home-v3.js');

let passed = 0;
const test = (name, fn) => { try { fn(); passed += 1; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}: ${error.stack || error}`); process.exitCode = 1; } };
const NOW = Date.parse('2026-09-13T16:00:00.000Z');
const payload = {
  schema: LiveWeek.SCHEMA, provider: 'nflverse', source: 'nflverse schedules', license: 'CC-BY-4.0',
  season: 2026, week: 2, fetchedAt: '2026-09-13T15:55:00.000Z', games: [
    { gameId: 'thu', season: 2026, week: 2, homeTeam: 'GB', awayTeam: 'WAS', kickoff: '2026-09-11T00:20:00Z', state: 'FINAL', homeScore: 27, awayScore: 18 },
    { gameId: 'early', season: 2026, week: 2, homeTeam: 'NYJ', awayTeam: 'BUF', kickoff: '2026-09-13T17:00:00Z', state: 'PRE_GAME' },
    { gameId: 'late', season: 2026, week: 2, homeTeam: 'KC', awayTeam: 'PHI', kickoff: '2026-09-13T20:25:00Z', state: 'PRE_GAME' },
    { gameId: 'night', season: 2026, week: 2, homeTeam: 'DAL', awayTeam: 'NYG', kickoff: '2026-09-14T00:20:00Z', state: 'PRE_GAME' },
    { gameId: 'mon', season: 2026, week: 2, homeTeam: 'LV', awayTeam: 'LAC', kickoff: '2026-09-15T02:00:00Z', state: 'PRE_GAME' },
    { gameId: 'post', season: 2026, week: 2, homeTeam: 'MIA', awayTeam: 'NE', kickoff: '2026-09-13T17:00:00Z', state: 'POSTPONED' },
  ]
};
const live = LiveWeek.normalize(payload, { now: NOW });
const player = (id, team, extra = {}) => ({ canonicalPlayerId: id, name: id, position: 'WR', sourceTeam: team, rosterSlot: 'WR', identity: { status: 'MATCHED', canonicalPlayerId: id, canonicalTeam: team }, ...extra });
const context = (extra = {}) => ({ season: 2026, week: 2, scoringFormat: 'half-ppr', fetchedAt: payload.fetchedAt, now: NOW, provider: 'Yahoo', injuries: new Map(), liveWeek: live, ...extra });
const enrich = (id, team, extra = {}, more = {}) => Current.enrichPlayer(player(id, team, extra), context(more));

test('01 Thursday completed starter maps final game', () => assert.equal(enrich('a', 'GB').currentWeek.game.state, 'FINAL'));
test('02 Thursday completed bench player remains final', () => assert.equal(enrich('b', 'WAS', { rosterSlot: 'BN' }).currentWeek.game.state, 'FINAL'));
test('03 Sunday early upcoming starter is changeable', () => assert.equal(enrich('c', 'NYJ').currentWeek.game.actionable, true));
test('04 Sunday early live starter locks', () => { const p = { ...payload, games: payload.games.map(g => g.gameId === 'early' ? { ...g, state: 'LIVE' } : g) }; const row = Current.enrichPlayer(player('d', 'BUF'), context({ liveWeek: LiveWeek.normalize(p, { now: NOW }) })); assert.equal(row.locked, true); });
test('05 Sunday early completed starter uses final state', () => { const p = { ...payload, games: payload.games.map(g => g.gameId === 'early' ? { ...g, state: 'FINAL', homeScore: 10, awayScore: 20 } : g) }; assert.equal(Current.enrichPlayer(player('e', 'BUF'), context({ liveWeek: LiveWeek.normalize(p, { now: NOW }) })).gameStatus, 'FINAL'); });
test('06 Sunday afternoon is unlocked before kickoff', () => assert.equal(enrich('f', 'KC').locked, false));
test('07 Sunday afternoon locks after kickoff', () => assert.equal(LiveWeek.normalize(payload, { now: Date.parse('2026-09-13T21:00:00Z') }).games.find(g => g.gameId === 'late').state, 'LOCKED_UNKNOWN'));
test('08 Sunday night kickoff maps exactly', () => assert.equal(enrich('g', 'DAL').gameStart, '2026-09-14T00:20:00.000Z'));
test('09 Monday opponent maps exactly', () => assert.equal(enrich('h', 'LAC').opponent, 'LV'));
test('10 bye-week player is explicit and not actionable', () => { const row = enrich('i', 'CHI'); assert.equal(row.gameStatus, 'BYE'); assert.equal(row.currentWeek.game.actionable, false); });
test('11 postponed game is explicit and not actionable', () => { const row = enrich('j', 'MIA'); assert.equal(row.gameStatus, 'POSTPONED'); assert.equal(row.currentWeek.game.actionable, false); });
test('12 unknown game status fails closed', () => { const game = Current.game(player('k', 'SEA'), { now: NOW, fetchedAt: payload.fetchedAt }); assert.equal(game.state, 'UNKNOWN'); assert.equal(game.actionable, false); });
test('13 kickoff is timezone-safe ISO UTC', () => assert.equal(Date.parse(enrich('l', 'PHI').gameStart), Date.parse('2026-09-13T20:25:00Z')));
test('14 valid player actual zero is preserved', () => assert.strictEqual(enrich('m', 'GB', { actualPoints: 0, actualPointsWeek: 2 }).currentWeek.actual.value, 0));
test('15 missing actual remains null', () => assert.strictEqual(enrich('n', 'GB').currentWeek.actual.value, null));
test('16 valid player projection is accepted', () => assert.equal(enrich('o', 'NYJ', { projection: 10.5, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }).projection, 10.5));
test('17 missing projection is unavailable', () => assert.equal(enrich('p', 'NYJ').currentWeek.projection.reason, 'MISSING_VALUE'));
test('18 stale projection is unavailable', () => assert.equal(enrich('q', 'NYJ', { projection: 8, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: '2026-09-11T00:00:00Z' }).currentWeek.projection.reason, 'STALE'));
test('19 wrong-week projection is unavailable', () => assert.equal(enrich('r', 'NYJ', { projection: 8, projectionSource: 'FIXTURE', projectionWeek: 1, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }).currentWeek.projection.reason, 'WEEK_MISMATCH'));
test('20 wrong-scoring projection is unavailable', () => assert.equal(enrich('s', 'NYJ', { projection: 8, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'full-ppr', projectionFetchedAt: payload.fetchedAt }).currentWeek.projection.reason, 'SCORING_FORMAT_MISMATCH'));
test('21 projection identity mismatch is unavailable', () => assert.equal(enrich('t', 'NYJ', { projection: 8, projectionSource: 'FIXTURE', projectionPlayerId: 'other', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }).currentWeek.projection.reason, 'IDENTITY_MISMATCH'));
test('22 completed actual replaces projection', () => assert.equal(enrich('u', 'GB', { actualPoints: 6, actualPointsWeek: 2, projection: 12, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }).currentWeek.outlookContribution.kind, 'ACTUAL'));
test('23 no actual plus projection double counting', () => { const row = enrich('v', 'GB', { actualPoints: 6, actualPointsWeek: 2, projection: 12, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }); assert.equal(row.currentWeek.outlookContribution.value, 6); });
test('24 live player without live expectation closes outlook', () => { const row = Current.enrichPlayer(player('w', 'BUF'), context({ liveWeek: LiveWeek.normalize({ ...payload, games: payload.games.map(g => g.gameId === 'early' ? { ...g, state: 'LIVE' } : g) }, { now: NOW }) })); assert.equal(Current.outlook({ starters: [{ slot: 'WR', player: row }] }).status, 'UNAVAILABLE'); });
test('25 complete lineup produces current outlook', () => { const final = enrich('x', 'GB', { actualPoints: 7, actualPointsWeek: 2 }), upcoming = enrich('y', 'NYJ', { projection: 9, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }); assert.equal(Current.outlook({ starters: [{ slot: 'RB', player: final }, { slot: 'WR', player: upcoming }] }).value, 16); });
test('26 missing starter projection closes outlook', () => assert.equal(Current.outlook({ starters: [{ slot: 'WR', player: enrich('z', 'NYJ') }] }).status, 'UNAVAILABLE'));
test('27 opponent outlook uses identical contract', () => { const row = enrich('aa', 'NYJ', { projection: 11, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }); assert.equal(Current.outlook({ starters: [{ slot: 'WR', player: row }] }).value, 11); });
test('28 home and away team orientation is correct', () => { assert.equal(LiveWeek.teamGame(live, 'KC').homeAway, 'HOME'); assert.equal(LiveWeek.teamGame(live, 'PHI').homeAway, 'AWAY'); });
const usageStore = weeks => ({ observations: id => weeks.map((week, index) => ({ canonicalPlayerId: id, season: 2026, week, observedAt: `2026-09-${8 + index}T00:00:00Z`, evidenceId: `${id}:${week}`, role: { snapShare: .5 + index / 10 }, opportunity: { targets: 4 + index, carries: 0, opportunities: 4 + index } })) });
test('29 one-game usage is labeled one-game sample', () => assert.equal(enrich('ab', 'NYJ', {}, { evidenceStore: usageStore([1]) }).currentWeek.usage.sampleQuality, 'ONE_GAME'));
test('30 multi-game usage is labeled developing', () => assert.equal(enrich('ac', 'NYJ', {}, { evidenceStore: usageStore([1, 2]) }).currentWeek.usage.sampleQuality, 'DEVELOPING'));
test('31 missing usage remains unavailable', () => assert.equal(enrich('ad', 'NYJ').currentWeek.usage.available, false));
test('32 stale usage is explicit', () => { const store = { observations: () => [{ canonicalPlayerId: 'ae', season: 2026, week: 1, observedAt: '2026-08-01T00:00:00Z', evidenceId: 'old', role: {}, opportunity: {} }] }; assert.equal(enrich('ae', 'NYJ', {}, { evidenceStore: store }).currentWeek.usage.freshness, 'STALE'); });
test('33 DST canonical identity resolves by team entity', () => { const index = Yahoo.buildCanonicalIndex([{ canonicalId: 'dst-lac', name: 'Chargers D/ST', position: 'DST', team: 'LAC' }]); assert.equal(Yahoo.reconcilePlayer({ name: 'Los Angeles Chargers', position: 'DEF', sourceTeam: 'LAC' }, index).canonicalPlayerId, 'dst-lac'); });
test('34 newly added player resolves by stable source ID', () => { const index = Yahoo.buildCanonicalIndex([{ canonicalId: 'new-rb', name: 'New Runner', position: 'RB', externalIds: { yahoo: '999' } }]); assert.equal(Yahoo.reconcilePlayer({ yahooPlayerId: '999', name: 'Different Display', position: 'RB' }, index).canonicalPlayerId, 'new-rb'); });
test('35 ambiguous identity remains unresolved', () => { const index = Yahoo.buildCanonicalIndex([{ canonicalId: 'one', name: 'Same Name', position: 'WR' }, { canonicalId: 'two', name: 'Same Name', position: 'WR' }]); assert.equal(Yahoo.reconcilePlayer({ name: 'Same Name', position: 'WR' }, index).status, 'AMBIGUOUS'); });
test('36 injury unknown stays unknown', () => assert.equal(enrich('af', 'NYJ').currentWeek.injury.status, 'UNKNOWN'));
test('37 injury questionable remains current', () => { const injuries = new Map([['ag', { playerId: 'ag', status: 'QUESTIONABLE', lastUpdated: payload.fetchedAt }]]); assert.equal(enrich('ag', 'NYJ', {}, { injuries }).currentWeek.injury.status, 'QUESTIONABLE'); });
test('38 injury out remains current', () => { const injuries = new Map([['ah', { playerId: 'ah', status: 'OUT', lastUpdated: payload.fetchedAt }]]); assert.equal(enrich('ah', 'NYJ', {}, { injuries }).currentWeek.injury.status, 'OUT'); });
test('39 locked player cannot become Start Sit action', () => { const row = enrich('ai', 'GB', { projection: 20, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }); assert.equal(StartSit.locked(row), true); });
test('40 upcoming unlocked player participates in evaluation', () => { const row = enrich('aj', 'NYJ', { projection: 20, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }); assert.equal(StartSit.locked(row), false); });
test('41 projection timeout leaves projection unavailable', () => assert.equal(enrich('ak', 'NYJ').currentWeek.projection.supported, false));
test('42 usage timeout leaves Yahoo evidence intact', () => { const row = enrich('al', 'NYJ', { actualPoints: 0, actualPointsWeek: 2 }, { evidenceStore: null }); assert.strictEqual(row.currentWeek.actual.value, 0); });
test('43 game provider timeout fails game actionability closed', () => { const row = Current.enrichPlayer(player('am', 'NYJ'), context({ liveWeek: null })); assert.equal(row.currentWeek.game.actionable, false); });
test('44 failed schedule subsystem preserves previous snapshot', () => { const source = fs.readFileSync(require.resolve('../js/yahoo-sync-v1.js'), 'utf8'); assert(source.includes("liveWeek:['liveWeek']")); assert(source.includes("status:'STALE'")); });
test('45 multi-profile same-player game facts are reusable', () => assert.strictEqual(LiveWeek.teamGame(live, 'NYJ').gameId, LiveWeek.teamGame(live, 'NYJ').gameId));
test('46 different scoring formats isolate projections', () => { const row = player('an', 'NYJ', { projection: 10, projectionSource: 'FIXTURE', projectionWeek: 2, projectionScoringFormat: 'half-ppr', projectionFetchedAt: payload.fetchedAt }); assert.equal(Current.enrichPlayer(row, context()).projection, 10); assert.equal(Current.enrichPlayer(row, context({ scoringFormat: 'full-ppr' })).projection, null); });
test('47 new evidence remains non-authoritative to recommendations', () => assert.equal(enrich('ao', 'NYJ').currentWeek.recommendationAuthority, false));
test('48 Weekly Read fails closed without outlook', () => assert(Current.weeklyRead(Current.summarize([enrich('ap', 'NYJ')]), { status: 'UNAVAILABLE' }, { status: 'UNAVAILABLE' }).text.includes('unavailable')));
test('49 Position Battle requires supported projections', () => assert.notEqual(Home.positionBattle([{ slot: 'WR', player: enrich('aq', 'NYJ') }], [{ slot: 'WR', player: enrich('ar', 'BUF') }])[0].evidence, 'SUPPORTED'));
test('50 rebuilt snapshot reflects refreshed schedule evidence', () => { const base = { week: 2, scoring: 'half-ppr', snapshot: { provider: 'Yahoo', fetchedAt: payload.fetchedAt, league: { season: 2026 }, liveWeek: payload }, roster: [player('as', 'NYJ')], available: [], lineup: { starters: [{ slot: 'WR', player: player('as', 'NYJ') }], bench: [], ir: [], unassigned: [] }, opponent: { roster: [] }, opponentLineup: { starters: [], bench: [], ir: [], unassigned: [] } }; const result = Current.build({ model: base, now: NOW }); assert.equal(result.roster[0].opponent, 'BUF'); });

if (!process.exitCode) console.log(`Live player intelligence tests: ${passed}/${passed} passed`);
