'use strict';
const assert = require('assert');
require('../js/yahoo-season-v1.js');
const Sync = require('../js/yahoo-sync-v1.js');

const data = new Map();
const storage = {
  getItem: key => data.get(key) || null,
  setItem: (key, value) => data.set(key, value),
};
const profile = {
  id: 'p1', actualTeams: 10, season: 2026,
  settings: { teams: 10, scoring: 'half', passTD: 6 },
};
let mode = 'current';
const transport = {
  status: async () => ({ connected: true }),
  discover: async () => ({ raw: { leagues: [
    { leagueKey: '461.l.1', name: 'League', season: 2026, gameCode: 'nfl', teamCount: 10 },
  ] } }),
  sync: async () => {
    if (mode === 'offline') throw new Error('offline');
    return {
      leagueKey: '461.l.1', fetchedAt: '2026-08-23T00:00:00Z',
      league: { leagues: [{ leagueKey: '461.l.1', name: 'League', season: 2026, gameCode: 'nfl', teamCount: 10 }] },
      settings: { settingsNormalized: { teamCount: 10, scoringType: 'half-ppr', passingTouchdownPoints: 6 } },
      teams: { teams: [] }, players: { players: [] },
      transactions: mode === 'partial' ? {} : { transactions: [{ transactionKey: 'tr.1', type: 'add' }] },
      errors: mode === 'partial' ? { transactions: 'temporary failure' } : {},
    };
  },
  disconnect: async () => ({ connected: false }),
};
const response = (body, overrides = {}) => ({
  ok: true, status: 200,
  url: 'https://localhost:8787/api/yahoo/sync?league_key=461.l.1', redirected: false,
  headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null },
  text: async () => body,
  ...overrides,
});
const validBundle = {
  leagueKey: '461.l.1', fetchedAt: '2026-09-19T00:00:00Z',
  teamRosters: {}, players: {}, errors: {},
};

(async () => {
  let pass = 0;
  const controller = Sync.createController({ transport, storage, clock: () => '2026-08-23T00:00:00Z' });
  const discovered = await controller.discover(2026);
  assert.strictEqual(discovered.leagues.length, 1); pass++;
  assert.throws(() => controller.mapLeague(profile, null)); pass++;
  controller.mapLeague(profile, discovered.leagues[0]);
  assert.strictEqual(controller.read('p1').mapping.explicitlyConfirmed, true); pass++;
  await controller.sync({ profile, canonicalPlayers: [], archives: [] });
  assert.strictEqual(controller.read('p1').sync.status, 'CURRENT'); pass++;
  mode = 'partial';
  await controller.sync({ profile, canonicalPlayers: [], archives: [] });
  assert.strictEqual(controller.read('p1').snapshot.transactions[0].transactionKey, 'tr.1');
  assert.strictEqual(controller.read('p1').snapshot.datasets.transactions.status, 'STALE'); pass++;
  mode = 'offline';
  await assert.rejects(() => controller.sync({ profile, canonicalPlayers: [], archives: [] }));
  assert.strictEqual(controller.read('p1').sync.status, 'STALE');
  assert.strictEqual(controller.read('p1').snapshot.league.name, 'League'); pass++;

  const diagnosticTransport = Sync.createTransport({ fetchImpl: async () => ({
    ok: false, status: 403,
    json: async () => ({ error: 'Yahoo denied Fantasy Sports access', classification: 'INSUFFICIENT_FANTASY_PERMISSION', yahooHttpStatus: 403, yahooErrorCode: 'permission_denied', reconnectRequired: false }),
  }) });
  await assert.rejects(() => diagnosticTransport.discover(2026), error =>
    error.classification === 'INSUFFICIENT_FANTASY_PERMISSION'
    && error.yahooHttpStatus === 403
    && error.yahooErrorCode === 'permission_denied'
    && !error.reconnectRequired
  ); pass++;

  const timeoutTransport = Sync.createTransport({
    timeoutMs: 5,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) =>
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    ),
  });
  await assert.rejects(() => timeoutTransport.discover(2026), error =>
    error.classification === 'BRIDGE_TIMEOUT'
    && error.reconnectRequired === false
    && !/token|secret|code=/i.test(error.message)
  ); pass++;

  // A: a cached HTML app shell is rejected, never interpreted as Yahoo data.
  const htmlFallback = Sync.createTransport({ fetchImpl: async () => response('<html>cached app shell</html>') });
  await assert.rejects(() => htmlFallback.sync('461.l.1'), error =>
    error.classification === 'PARSER_RESPONSE_SHAPE_FAILURE'
    && error.responseMetadata.firstNonWhitespace === '<'
    && !/cached app shell/i.test(error.message)
  ); pass++;

  // B: malformed JSON is rejected with bounded, non-payload diagnostics.
  const malformed = Sync.createTransport({ fetchImpl: async () => response('{"leagueKey":') });
  await assert.rejects(() => malformed.sync('461.l.1'), error =>
    error.classification === 'PARSER_RESPONSE_SHAPE_FAILURE'
    && error.responseMetadata.rawBytes === 13
    && error.responseMetadata.topLevelKeys.length === 0
  ); pass++;

  // C: the production bridge bundle contract is accepted.
  const production = Sync.createTransport({ fetchImpl: async () => response(JSON.stringify({
    ...validBundle, league: {}, settings: {}, teams: {}, standings: {}, matchups: {}, transactions: {}, liveWeek: {},
  })) });
  assert.strictEqual((await production.sync('461.l.1')).leagueKey, '461.l.1'); pass++;

  // D: optional evidence can be absent without invalidating core Yahoo sync data.
  const optionalMissing = Sync.createTransport({ fetchImpl: async () => response(JSON.stringify(validBundle)) });
  assert.strictEqual((await optionalMissing.sync('461.l.1')).fetchedAt, validBundle.fetchedAt); pass++;

  // E: valid JSON with the wrong structural contract fails closed.
  const wrongShape = Sync.createTransport({ fetchImpl: async () => response(JSON.stringify({ status: 'ok' })) });
  await assert.rejects(() => wrongShape.sync('461.l.1'), error =>
    error.classification === 'PARSER_RESPONSE_SHAPE_FAILURE'
    && error.responseMetadata.firstNonWhitespace === '{'
    && error.responseMetadata.validSyncBundle === false
  ); pass++;

  console.log(JSON.stringify({ passCount: pass, failCount: 0, failures: [] }));
})().catch(error => {
  console.log(JSON.stringify({ passCount: 0, failCount: 1, failures: [error.stack] }));
  process.exit(1);
});
