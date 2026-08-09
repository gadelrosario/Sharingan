'use strict';

const fs = require('fs');
const path = require('path');
const { createHarness } = require('../tests/recommendation-baseline-harness.js');

const ROOT = path.resolve(__dirname, '..');
const SLOTS = [1, 7, 10];
const RUNS_PER_SLOT = 10;

function roundForPick(pick) {
  return Math.ceil(pick / 10);
}

function maximumPositionConcentration(picks, windowSize = 8) {
  let maximum = { count: 0, position: null, startPick: null, endPick: null };
  for (let start = 0; start <= picks.length - windowSize; start += 1) {
    const window = picks.slice(start, start + windowSize);
    const counts = window.reduce((memo, row) => {
      memo[row.pos] = (memo[row.pos] || 0) + 1;
      return memo;
    }, {});
    for (const [position, count] of Object.entries(counts)) {
      if (count > maximum.count) maximum = { count, position, startPick: window[0].pick, endPick: window.at(-1).pick };
    }
  }
  return maximum;
}

function summarizeRun(slot, run, picks) {
  const deviations = picks.filter(row => Number.isFinite(row.sourceRank)).map(row => row.pick - row.sourceRank);
  const firstAtPosition = Object.fromEntries(['QB', 'RB', 'WR', 'TE', 'K', 'DST'].map(position => {
    const found = picks.find(row => row.pos === position);
    return [position, found ? found.pick : null];
  }));
  const byRound = {};
  for (const row of picks) {
    const round = roundForPick(row.pick);
    byRound[round] ||= {};
    byRound[round][row.pos] = (byRound[round][row.pos] || 0) + 1;
  }
  return {
    slot,
    run,
    firstAtPosition,
    maximumEightPickConcentration: maximumPositionConcentration(picks),
    averageSourceDeviation: deviations.reduce((sum, value) => sum + value, 0) / deviations.length,
    maximumFall: Math.max(...deviations),
    maximumReach: Math.min(...deviations),
    firstFiveUserPicks: picks.filter(row => row.team === slot).slice(0, 5).map(row => ({ pick: row.pick, name: row.name, pos: row.pos, sourceRank: row.sourceRank })),
    byRound,
  };
}

function injuryCoverage() {
  const players = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/players.json'), 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/injuries_2026.json'), 'utf8'));
  const records = new Map((snapshot.records || []).map(record => [String(record.playerId), record]));
  const ranked = players.filter(player => Number.isFinite(Number(player.fantasylandOverallRank))).sort((a, b) => Number(a.fantasylandOverallRank) - Number(b.fantasylandOverallRank));
  const coverage = limit => {
    const pool = ranked.filter(player => Number(player.fantasylandOverallRank) <= limit);
    const unmatched = pool.filter(player => !records.has(String(player.id)));
    return { total: pool.length, matched: pool.length - unmatched.length, unmatched: unmatched.map(player => ({ id: player.id, name: player.name, rank: Number(player.fantasylandOverallRank) })) };
  };
  const unmatchedAll = players.filter(player => !records.has(String(player.id))).map(player => ({ id: player.id, name: player.name, rank: Number.isFinite(Number(player.fantasylandOverallRank)) ? Number(player.fantasylandOverallRank) : null }));
  return { snapshotFetchedAt: snapshot.fetchedAt, records: records.size, canonicalPlayers: players.length, unmatchedAll, top50: coverage(50), top100: coverage(100), top150: coverage(150) };
}

function run() {
  const harness = createHarness({ unified: true });
  const summaries = [];
  let representativeFirst50 = null;
  for (const slot of SLOTS) {
    for (let iteration = 1; iteration <= RUNS_PER_SLOT; iteration += 1) {
      const picks = harness.stressPicksAtSlot(50, slot);
      summaries.push(summarizeRun(slot, iteration, picks));
      if (slot === 10 && iteration === 1) representativeFirst50 = picks.map(row => ({ pick: row.pick, name: row.name, pos: row.pos, sourceRank: row.sourceRank, deviation: Number.isFinite(row.sourceRank) ? row.pick - row.sourceRank : null, sourceTier: row.sourceTier, finalDecisionScore: row.finalDecisionScore, injuryAdjustment: row.debug?.injury?.finalAdjustment ?? 0 }));
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    configuration: { teams: 10, scoring: 'half-PPR', quarterbackFormat: 'one-QB', slots: SLOTS, runsPerSlot: RUNS_PER_SLOT, picksPerRun: 50 },
    aggregate: {
      runs: summaries.length,
      firstQuarterbackPickRange: [Math.min(...summaries.map(row => row.firstAtPosition.QB)), Math.max(...summaries.map(row => row.firstAtPosition.QB))],
      firstTightEndPickRange: [Math.min(...summaries.map(row => row.firstAtPosition.TE)), Math.max(...summaries.map(row => row.firstAtPosition.TE))],
      firstKickerPick: summaries.some(row => row.firstAtPosition.K != null) ? Math.min(...summaries.map(row => row.firstAtPosition.K).filter(Number.isFinite)) : null,
      firstDefensePick: summaries.some(row => row.firstAtPosition.DST != null) ? Math.min(...summaries.map(row => row.firstAtPosition.DST).filter(Number.isFinite)) : null,
      maximumEightPickConcentration: summaries.reduce((best, row) => row.maximumEightPickConcentration.count > best.count ? row.maximumEightPickConcentration : best, { count: 0 }),
      averageSourceDeviation: summaries.reduce((sum, row) => sum + row.averageSourceDeviation, 0) / summaries.length,
      maximumFall: Math.max(...summaries.map(row => row.maximumFall)),
      maximumReach: Math.min(...summaries.map(row => row.maximumReach)),
    },
    summaries,
    representativeFirst50,
    injuryCoverage: injuryCoverage(),
  };
  const output = path.join(ROOT, 'outputs/player_audit/jonin_4_2_5_stress_report.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, aggregate: report.aggregate, injuryCoverage: report.injuryCoverage }, null, 2));
}

run();
