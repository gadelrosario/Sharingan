'use strict';

const assert = require('assert');
const Season = require('../js/season-command-center-v1.js');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const rosterSlots = ['QB', 'RB', 'BN'];

function profileFixture(id, name, userDraftSlot, scoring) {
  return { id, displayName: name, leagueName: name, actualTeams: 10, settings: { scoring } };
}

function archiveFixture(profile, userDraftSlot, prefix) {
  const history = [];
  for (let overallPick = 1; overallPick <= 20; overallPick += 1) {
    const round = Math.ceil(overallPick / 10);
    const within = ((overallPick - 1) % 10) + 1;
    const teamSlot = round % 2 ? within : 11 - within;
    history.push({
      overallPick,
      teamSlot,
      canonicalPlayerId: `${prefix}-p${overallPick}`,
      playerName: `${prefix} Archive Player ${overallPick}`,
      position: round === 1 ? 'QB' : 'RB',
      nflTeam: prefix,
    });
  }
  return {
    id: `archive-${profile.id}`,
    archiveId: `archive-${profile.id}`,
    kind: 'archived-session',
    profileId: profile.id,
    completedAt: `2026-08-${userDraftSlot < 10 ? `0${userDraftSlot}` : userDraftSlot}T12:00:00.000Z`,
    snapshot: {
      status: 'complete',
      sessionId: `session-${profile.id}`,
      slot: 1,
      updatedAt: '2026-08-24T12:00:00.000Z',
      leagueConfiguration: { teams: 10, totalPicks: 20 },
      settings: { scoring: profile.settings.scoring, rosterSlots },
      history: [],
    },
    exportRecord: {
      league: { teamCount: 10, userDraftSlot },
      draftHistory: history,
    },
  };
}

function yahooFixture(profile, userDraftSlot, prefix) {
  const userKey = `yahoo:${profile.id}:user`;
  return {
    snapshot: {
      schema: 'fantasy-hq-yahoo-season-1',
      provider: 'Yahoo',
      profileId: profile.id,
      league: { name: `${profile.displayName} Yahoo`, teamCount: 10, currentWeek: 2 },
      settings: { scoringType: profile.settings.scoring, rosterSlots },
      teams: [
        {
          teamKey: userKey,
          teamSlot: userDraftSlot,
          name: `${prefix} Yahoo User`,
          roster: [
            { canonicalPlayerId: `${prefix}-y-qb`, name: `${prefix} Yahoo QB`, position: 'QB', rosterSlot: 'QB' },
            { canonicalPlayerId: `${prefix}-y-rb`, name: `${prefix} Yahoo RB`, position: 'RB', rosterSlot: 'BN' },
          ],
        },
        { teamKey: `yahoo:${profile.id}:opp`, teamSlot: userDraftSlot === 10 ? 9 : userDraftSlot + 1, name: `${prefix} Opponent`, roster: [] },
      ],
      userDraftSlot,
      userTeamKey: userKey,
      availablePlayers: [],
      transactions: [],
      standings: [],
      matchups: { week: 2, matchups: [{ matchupId: `${prefix}-m1`, teamKeys: [userKey, `yahoo:${profile.id}:opp`] }] },
      subsystemErrors: {},
      seasonMode: { fantasyWeek: 2 },
    },
    sync: { status: 'CURRENT', lastSuccessfulSyncAt: '2026-08-24T12:00:00.000Z', error: null },
  };
}

const profileA = profileFixture('league-a', 'League A', 6, 'half');
const profileB = profileFixture('league-b', 'League B', 3, 'full');
const archiveA = archiveFixture(profileA, 6, 'A');
const archiveB = archiveFixture(profileB, 3, 'B');
const archives = [archiveA, archiveB];
const yahooA = yahooFixture(profileA, 6, 'A');
const yahooB = yahooFixture(profileB, 3, 'B');

function resolve(profile, live) {
  const resolution = Season.resolveSeasonState({ live, entries: archives, profile, canonicalPlayers: [] });
  return { resolution, model: Season.buildModel({ state: resolution.state, profile }) };
}

function visibleSurfaceContract(model) {
  return {
    profileId: model.profileId,
    homeTeamKey: model.userTeamResolution.teamKey,
    fullTeamKey: model.userTeam?.teamKey,
    matchupTeamKey: model.matchup?.teamKeys?.find(key => key === model.userTeamResolution.teamKey) || model.userTeamResolution.teamKey,
    gridMyTeamKeys: model.teams.filter(team => team.teamKey === model.userTeamResolution.teamKey).map(team => team.teamKey),
    teamSlot: model.userTeamResolution.teamSlot,
    rosterIds: model.roster.map(player => player.canonicalPlayerId),
    scoring: model.scoring,
    source: model.sourceLabel,
    week: model.week,
  };
}

test('Profile A resolves its own successful Yahoo identity at Slot 6', () => {
  const { resolution, model } = resolve(profileA, yahooA);
  assert.strictEqual(resolution.source, 'YAHOO');
  assert.strictEqual(model.userTeamResolution.teamSlot, 6);
  assert.deepStrictEqual(model.roster.map(player => player.name), ['A Yahoo QB', 'A Yahoo RB']);
});

test('Profile B resolves its own successful Yahoo identity at Slot 3', () => {
  const { resolution, model } = resolve(profileB, yahooB);
  assert.strictEqual(resolution.source, 'YAHOO');
  assert.strictEqual(model.userTeamResolution.teamSlot, 3);
  assert.deepStrictEqual(model.roster.map(player => player.name), ['B Yahoo QB', 'B Yahoo RB']);
});

test('Profile B falls back to only its immutable archive Slot 3', () => {
  const { resolution, model } = resolve(profileB, null);
  assert.strictEqual(resolution.source, 'DRAFT_ARCHIVE');
  assert.strictEqual(model.userTeamResolution.teamSlot, 3);
  assert.deepStrictEqual(model.roster.map(player => player.name), ['B Archive Player 3', 'B Archive Player 18']);
  assert.ok(model.roster.every(player => player.canonicalPlayerId.startsWith('B-')));
});

test('Profile A archive fallback uses immutable Slot 6 rather than stale session Slot 1', () => {
  const { resolution, model } = resolve(profileA, null);
  assert.strictEqual(resolution.source, 'DRAFT_ARCHIVE');
  assert.strictEqual(model.userTeamResolution.teamSlot, 6);
  assert.deepStrictEqual(model.roster.map(player => player.name), ['A Archive Player 6', 'A Archive Player 15']);
  assert.notStrictEqual(model.userTeamResolution.teamSlot, 1);
});

test('Season Home, full My Team, Matchup, and League Grid share the active profile team', () => {
  const a = visibleSurfaceContract(resolve(profileA, yahooA).model);
  const b = visibleSurfaceContract(resolve(profileB, null).model);
  for (const surface of [a, b]) {
    assert.strictEqual(surface.homeTeamKey, surface.fullTeamKey);
    assert.strictEqual(surface.matchupTeamKey, surface.homeTeamKey);
    assert.deepStrictEqual(surface.gridMyTeamKeys, [surface.homeTeamKey]);
  }
  assert.notStrictEqual(a.homeTeamKey, b.homeTeamKey);
});

test('A to B to A restores each profile roster and slot without retained state', () => {
  const firstA = visibleSurfaceContract(resolve(profileA, yahooA).model);
  const b = visibleSurfaceContract(resolve(profileB, null).model);
  const secondA = visibleSurfaceContract(resolve(profileA, yahooA).model);
  assert.deepStrictEqual(secondA, firstA);
  assert.strictEqual(firstA.teamSlot, 6);
  assert.strictEqual(b.teamSlot, 3);
  assert.notDeepStrictEqual(firstA.rosterIds, b.rosterIds);
  assert.ok(!b.rosterIds.some(id => firstA.rosterIds.includes(id)));
});

test('future Season inputs remain profile and source specific', () => {
  const a = visibleSurfaceContract(resolve(profileA, yahooA).model);
  const b = visibleSurfaceContract(resolve(profileB, null).model);
  assert.deepStrictEqual({ profileId: a.profileId, scoring: a.scoring, source: a.source, week: a.week }, { profileId: 'league-a', scoring: 'half', source: 'Yahoo', week: 2 });
  assert.deepStrictEqual({ profileId: b.profileId, scoring: b.scoring, source: b.source, week: b.week }, { profileId: 'league-b', scoring: 'full', source: 'Draft Snapshot', week: 1 });
});

test('profile Yahoo snapshots, archives, and settings remain byte-for-byte isolated', () => {
  const bytes = JSON.stringify({ yahooA, yahooB, archiveA, archiveB, profileA, profileB });
  resolve(profileA, yahooA);
  resolve(profileB, null);
  resolve(profileA, null);
  resolve(profileB, yahooB);
  assert.strictEqual(JSON.stringify({ yahooA, yahooB, archiveA, archiveB, profileA, profileB }), bytes);
});

let passCount = 0;
const failures = [];
for (const [name, fn] of tests) {
  try { fn(); passCount += 1; } catch (error) { failures.push({ name, error: error.message }); }
}
console.log(JSON.stringify({ passCount, failCount: failures.length, failures }));
if (failures.length) process.exit(1);
