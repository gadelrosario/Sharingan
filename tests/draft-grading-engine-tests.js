const Grader = require('../js/draft-grading-engine-v1.js');
let passed = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const test = (name, fn) => { fn(); passed += 1; console.log(`✓ ${name}`); };
const positions = ['QB', 'RB', 'RB', 'RB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'WR', 'WR', 'WR', 'TE', 'TE', 'K', 'DST'];
const settings = { teams: 10, scoring: 'half', startQB: 1, startRB: 2, startWR: 3, startTE: 1, flex: 2, startK: 1, startDST: 1, bench: 6 };

function makeRoster(label, shape = positions, options = {}) {
  return shape.map((pos, index) => ({
    id: `${label}-${index}`,
    canonicalId: `${label}-${index}`,
    name: `${label} ${pos} ${index + 1}`,
    pos,
    overall: Math.max(1, index + 1 + (options.rankOffset || 0)),
    overallTier: index < (options.elite || 3) ? (index === 0 ? 'S' : 'A') : index < 10 ? 'B' : 'C',
    rookie: Boolean(options.rookies && index >= shape.length - options.rookies),
    ambiguity: options.risk && index < options.risk ? 'high' : 'low',
    availabilityRisk: options.risk && index < options.risk ? 'high' : 'low',
    leagueBreaker: Boolean(options.upside && index >= shape.length - options.upside),
    roleSecurity: options.safe ? 'high' : 'medium',
    draftPick: Math.max(1, index + 1 + (options.pickOffset || 0)),
  }));
}
function roomFromRosters(rosters, extra = {}) {
  const teams = rosters.map((players, index) => ({ teamId: index + 1, managerName: `Manager ${index + 1}`, players }));
  const picks = teams.flatMap(team => team.players.map(player => ({ overallPick: player.draftPick, teamId: team.teamId, playerId: player.id })));
  return { teams, players: rosters.flat(), picks, settings, ...extra };
}
const shape = (...values) => values;
const fixtures = [
  ['exceptional-balanced', makeRoster('Exceptional', positions, { elite: 7, pickOffset: 10, upside: 5, safe: true })],
  ['competent-ordinary', makeRoster('Competent', positions, { elite: 3, safe: true })],
  ['stars-and-scrubs', makeRoster('StarsScrubs', positions, { elite: 5, rankOffset: 18, risk: 5 })],
  ['strong-starters-weak-bench', makeRoster('StrongWeakBench', positions, { elite: 8, rankOffset: 10 })],
  ['deep-bench-mediocre-starters', makeRoster('DeepBench', positions, { rankOffset: 28, upside: 7 })],
  ['early-qb-reach', makeRoster('EarlyQB', positions, { rankOffset: 18 })],
  ['multiple-qb-hoarding', makeRoster('QBHoard', shape('QB','QB','QB','QB','RB','RB','RB','WR','WR','WR','WR','WR','TE','TE','RB','K','DST'))],
  ['missing-required-position', makeRoster('MissingTE', shape('QB','RB','RB','RB','RB','RB','WR','WR','WR','WR','WR','WR','WR','WR','K','DST','WR'))],
  ['excess-dst-k', makeRoster('Specialists', shape('QB','RB','RB','RB','WR','WR','WR','WR','TE','TE','K','K','K','DST','DST','DST','WR'))],
  ['high-upside-high-risk', makeRoster('RiskUpside', positions, { risk: 7, upside: 7, rookies: 6 })],
  ['safe-low-ceiling', makeRoster('SafeFloor', positions, { rankOffset: 25, safe: true })],
  ['identity-swap', makeRoster('Identity', positions, { elite: 4 })],
  ['ui-ownership-state', makeRoster('Ownership', positions, { elite: 4 })],
  ['yahoo-style-replay', makeRoster('YahooReplay', positions, { elite: 3, pickOffset: 2 })],
];

test('all six category scores reconcile exactly to the weighted overall score', () => {
  const result = Grader.evaluateDraft(roomFromRosters([fixtures[1][1]]));
  const team = result.teams[0];
  const weighted = Object.entries(result.categoryWeights).reduce((sum, [key, weight]) => sum + team.categories[key].score * weight, 0);
  assert(Math.abs(team.overallScore - Math.round(weighted * 10) / 10) <= 0.1, `${team.overallScore} != ${weighted}`);
  assert(Object.keys(team.categories).length === 6, 'six categories were not returned');
});

test('A+ is rare across the 14 deterministic calibration fixtures', () => {
  const grades = fixtures.map(([, roster]) => Grader.evaluateDraft(roomFromRosters([roster])).teams[0].grade);
  assert(grades.filter(grade => grade === 'A+').length <= 1, grades.join(','));
  assert(grades.filter(grade => grade.startsWith('B')).length >= 1, 'calibration has no B-range roster');
  console.log(`  calibration distribution: ${JSON.stringify(grades.reduce((out, grade) => ({ ...out, [grade]: (out[grade] || 0) + 1 }), {}))}`);
});

test('missing required position and excess specialists receive explicit penalties', () => {
  const missing = Grader.evaluateDraft(roomFromRosters([fixtures[7][1]])).teams[0];
  const excess = Grader.evaluateDraft(roomFromRosters([fixtures[8][1]])).teams[0];
  assert(missing.debug.missing.includes('TE'), 'missing TE not detected');
  assert(missing.weaknesses.some(text => text.includes('missing required')), 'missing-position feedback absent');
  assert(excess.debug.surplusPenalty > 0, 'specialist surplus not penalized');
  assert(excess.improvements.some(text => text.includes('Stream')), 'specialist action absent');
});

test('Gerard and UI ownership receive no scoring bonus', () => {
  const roster = fixtures[12][1];
  const ordinary = Grader.evaluateDraft(roomFromRosters([roster], { userTeamId: 1, selectedTeamId: 1 })).teams[0];
  const gerard = Grader.evaluateDraft({ ...roomFromRosters([roster]), teams: [{ teamId: 9, managerName: 'Gerard', players: roster }], userTeamId: 9, selectedTeamId: 9 }).teams[0];
  assert(ordinary.overallScore === gerard.overallScore && ordinary.grade === gerard.grade, 'ownership changed grade');
});

test('grades and odds follow rosters when manager ownership is permuted', () => {
  const strong = fixtures[0][1], weak = fixtures[10][1];
  const first = Grader.evaluateDraft(roomFromRosters([strong, weak]));
  const second = Grader.evaluateDraft({ ...roomFromRosters([weak, strong]), teams: [{ teamId: 1, managerName: 'Gerard', players: weak }, { teamId: 2, managerName: 'Other', players: strong }] });
  const map = result => new Map(result.teams.map(team => [team.rosterSignature, team]));
  for (const [signature, original] of map(first)) {
    const swapped = map(second).get(signature);
    assert(swapped && swapped.overallScore === original.overallScore && swapped.championshipOdds === original.championshipOdds, 'result followed manager identity');
  }
});

test('mock, live, simulated, and imported Yahoo replay use identical grading semantics', () => {
  const base = roomFromRosters([fixtures[13][1], fixtures[1][1]]);
  const normalized = sourceMode => JSON.stringify(Grader.evaluateDraft({ ...base, sourceMode }).teams.map(team => ({ signature: team.rosterSignature, grade: team.grade, score: team.overallScore, odds: team.championshipOdds, percentile: team.draftPercentile, categories: team.categories, strengths: team.strengths, weaknesses: team.weaknesses, improvements: team.improvements })));
  const yahooRecord = { league: settings, managers: { 1: 'Manager 1', 2: 'Manager 2' }, picks: base.picks.map(pick => ({ overallPick: pick.overallPick, teamSlot: pick.teamId, playerId: pick.playerId })) };
  const imported = JSON.stringify(Grader.evaluateImportedDraft(yahooRecord, base.players).teams.map(team => ({ signature: team.rosterSignature, grade: team.grade, score: team.overallScore, odds: team.championshipOdds, percentile: team.draftPercentile, categories: team.categories, strengths: team.strengths, weaknesses: team.weaknesses, improvements: team.improvements })));
  assert(normalized('practice') === normalized('live'), 'mock/live parity failed');
  assert(normalized('practice') === normalized('simulated'), 'mock/simulation parity failed');
  assert(normalized('practice') === normalized('yahoo-import-replay') && normalized('practice') === imported, 'mock/import parity failed');
});

test('championship odds sum to 100 and remain uncertainty-aware', () => {
  const rosters = fixtures.slice(0, 10).map(([, roster]) => roster);
  const result = Grader.evaluateDraft(roomFromRosters(rosters));
  assert(result.championshipOddsTotal === 100, `odds total ${result.championshipOddsTotal}`);
  assert(Math.max(...result.teams.map(team => team.championshipOdds)) < 35, 'odds are implausibly concentrated');
  assert(result.teams.every(team => team.estimateLabel.includes('not a season guarantee')), 'estimate disclaimer missing');
});

test('feedback is roster-specific and references players or exact roster conditions', () => {
  const report = Grader.evaluateDraft(roomFromRosters([fixtures[6][1]])).teams[0];
  assert(report.strengths.some(text => text.includes('QB') || text.includes('Hoard')), 'strength lacks roster reference');
  assert(report.weaknesses.some(text => text.includes('quarterbacks')), 'QB-hoard weakness absent');
  assert(report.improvements.some(text => text.includes('third quarterback')), 'actionable QB fix absent');
});

console.log(`Draft grading deterministic tests: ${passed}/${passed} passed`);
