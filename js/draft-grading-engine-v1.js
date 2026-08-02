(function (root) {
  'use strict';

  const CATEGORY_WEIGHTS = Object.freeze({
    draftValue: 0.22,
    rosterConstruction: 0.24,
    positionalTiming: 0.14,
    riskManagement: 0.14,
    benchUpside: 0.14,
    leagueFit: 0.12,
  });
  const CATEGORY_LABELS = Object.freeze({
    draftValue: 'Draft Value',
    rosterConstruction: 'Roster Construction',
    positionalTiming: 'Positional Timing',
    riskManagement: 'Risk Management',
    benchUpside: 'Bench Upside',
    leagueFit: 'League Fit',
  });
  const CORE_POSITIONS = Object.freeze(['QB', 'RB', 'WR', 'TE']);
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
  const round = (value, places = 0) => {
    const scale = 10 ** places;
    return Math.round((Number(value) || 0) * scale) / scale;
  };
  const finite = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const normalizePosition = value => {
    const position = String(value || '').trim().toUpperCase();
    return ['DEF', 'DEFENSE', 'D/ST'].includes(position) ? 'DST' : position;
  };
  const ordinal = value => {
    const number = Math.max(1, Math.round(value));
    const mod100 = number % 100;
    const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th');
    return `${number}${suffix}`;
  };
  const gradeForCategory = score =>
    score >= 96 ? 'A+' : score >= 90 ? 'A' : score >= 86 ? 'A-' : score >= 82 ? 'B+' :
      score >= 76 ? 'B' : score >= 72 ? 'B-' : score >= 68 ? 'C+' : score >= 62 ? 'C' :
        score >= 58 ? 'C-' : score >= 54 ? 'D+' : score >= 48 ? 'D' : 'F';
  const referencePercentile = score => round(100 / (1 + Math.exp(-(clamp(score) - 74) / 6.5)), 1);
  const gradeForPercentile = percentile =>
    percentile >= 98 ? 'A+' : percentile >= 90 ? 'A' : percentile >= 78 ? 'A-' :
      percentile >= 65 ? 'B+' : percentile >= 45 ? 'B' : percentile >= 30 ? 'B-' :
        percentile >= 20 ? 'C+' : percentile >= 10 ? 'C' : percentile >= 5 ? 'C-' :
          percentile >= 2.5 ? 'D' : 'F';
  const tierStrength = tier => ({ S: 100, A: 91, B: 80, C: 69, D: 57, E: 46, F: 35 }[String(tier || '').toUpperCase()] || 58);
  const playerRank = player => finite(player?.overall) ?? finite(player?.fantasyProsOverallRank) ?? null;
  const playerStrength = player => {
    const rank = playerRank(player);
    const rankScore = rank === null ? 48 : clamp(101 - rank * 0.48, 25, 100);
    return clamp(rankScore * 0.68 + tierStrength(player?.overallTier || player?.tier) * 0.32, 25, 100);
  };
  const playerName = player => String(player?.name || 'Unknown player');
  const playerKey = player => String(player?.canonicalId ?? player?.id ?? player?.playerId ?? playerName(player));
  const countByPosition = players => players.reduce((counts, player) => {
    const position = normalizePosition(player?.pos || player?.position);
    counts[position] = (counts[position] || 0) + 1;
    return counts;
  }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });

  function normalizedSettings(settings = {}) {
    return Object.freeze({
      teams: Math.max(2, finite(settings.teams) ?? 10),
      scoring: ['standard', 'half', 'full'].includes(settings.scoring) ? settings.scoring : 'half',
      startQB: Math.max(0, finite(settings.startQB) ?? 1),
      startRB: Math.max(0, finite(settings.startRB) ?? 2),
      startWR: Math.max(0, finite(settings.startWR) ?? 3),
      startTE: Math.max(0, finite(settings.startTE) ?? 1),
      flex: Math.max(0, finite(settings.flex) ?? 2),
      startK: Math.max(0, finite(settings.startK) ?? 1),
      startDST: Math.max(0, finite(settings.startDST) ?? 1),
      bench: Math.max(0, finite(settings.bench) ?? 6),
    });
  }

  function assignLineup(players, settings) {
    const remaining = [...players].sort((a, b) => playerStrength(b) - playerStrength(a) || playerName(a).localeCompare(playerName(b)));
    const starters = [];
    const take = (position, count) => {
      for (let index = 0; index < count; index += 1) {
        const found = remaining.findIndex(player => normalizePosition(player.pos || player.position) === position);
        if (found < 0) break;
        starters.push(remaining.splice(found, 1)[0]);
      }
    };
    take('QB', settings.startQB);
    take('RB', settings.startRB);
    take('WR', settings.startWR);
    take('TE', settings.startTE);
    for (let index = 0; index < settings.flex; index += 1) {
      const found = remaining.findIndex(player => ['RB', 'WR', 'TE'].includes(normalizePosition(player.pos || player.position)));
      if (found < 0) break;
      starters.push(remaining.splice(found, 1)[0]);
    }
    take('K', settings.startK);
    take('DST', settings.startDST);
    return Object.freeze({ starters: Object.freeze(starters), bench: Object.freeze(remaining) });
  }

  function missingPositions(counts, settings) {
    return [
      ['QB', settings.startQB], ['RB', settings.startRB], ['WR', settings.startWR],
      ['TE', settings.startTE], ['K', settings.startK], ['DST', settings.startDST],
    ].flatMap(([position, required]) => Array(Math.max(0, required - (counts[position] || 0))).fill(position));
  }

  function picksForTeam(team, input) {
    const playerMap = new Map((input.players || []).map(player => [String(player.id ?? player.playerId ?? player.canonicalId), player]));
    const entries = (input.picks || input.history || []).filter(pick => String(pick.teamId ?? pick.team ?? pick.teamSlot) === String(team.teamId ?? team.team ?? team.id));
    if (entries.length) return entries.map(entry => ({
      pick: finite(entry.pick ?? entry.overallPick ?? entry.draftOrder),
      player: playerMap.get(String(entry.playerId ?? entry.id)) || team.players?.find(player => playerKey(player) === String(entry.playerId ?? entry.id)) || null,
    })).filter(entry => entry.player);
    return (team.players || []).map((player, index) => ({ pick: finite(player.draftPick) ?? index + 1, player }));
  }

  function rosterForTeam(team, input) {
    if (Array.isArray(team.players)) return team.players;
    const ids = team.playerIds || team.roster || [];
    const map = new Map((input.players || []).map(player => [String(player.id ?? player.playerId ?? player.canonicalId), player]));
    return ids.map(id => map.get(String(id))).filter(Boolean);
  }

  function category(score, explanation) {
    const numeric = round(clamp(score), 1);
    return Object.freeze({ score: numeric, grade: gradeForCategory(numeric), explanation });
  }

  function evaluateRoster(team, input, settings) {
    const players = rosterForTeam(team, input);
    const picks = picksForTeam(team, { ...input, players: input.players || players });
    const counts = countByPosition(players);
    const lineup = assignLineup(players, settings);
    const missing = missingPositions(counts, settings);
    const requiredRosterSize = settings.startQB + settings.startRB + settings.startWR + settings.startTE + settings.flex + settings.startK + settings.startDST + settings.bench;
    const invalidSize = Math.abs(players.length - requiredRosterSize);
    const rankedPicks = picks.filter(entry => entry.pick !== null && playerRank(entry.player) !== null);
    const valueDeltas = rankedPicks.map(entry => entry.pick - playerRank(entry.player));
    const positiveValues = valueDeltas.filter(value => value > 0);
    const reaches = valueDeltas.filter(value => value < -5);
    const averageDelta = valueDeltas.length ? valueDeltas.reduce((sum, value) => sum + value, 0) / valueDeltas.length : 0;
    const valueCoverage = players.length ? rankedPicks.length / players.length : 0;
    const draftValueScore = clamp(72 + averageDelta * 0.72 + positiveValues.length * 0.8 - reaches.length * 1.4 - (1 - valueCoverage) * 12, 25, 99);
    const bestValue = rankedPicks.slice().sort((a, b) => (b.pick - playerRank(b.player)) - (a.pick - playerRank(a.player)))[0];

    const starterAverage = lineup.starters.length ? lineup.starters.reduce((sum, player) => sum + playerStrength(player), 0) / lineup.starters.length : 0;
    const coreDepth = counts.RB + counts.WR + counts.TE;
    const surplusPenalty = Math.max(0, counts.QB - Math.max(2, settings.startQB)) * 6 + Math.max(0, counts.TE - Math.max(2, settings.startTE + 1)) * 4 + Math.max(0, counts.K - settings.startK) * 8 + Math.max(0, counts.DST - settings.startDST) * 8;
    const completionPenalty = missing.reduce((sum, position) => sum + (['QB', 'TE'].includes(position) ? 12 : ['K', 'DST'].includes(position) ? 7 : 10), 0) + invalidSize * 4;
    const depthBonus = clamp((coreDepth - (settings.startRB + settings.startWR + settings.startTE + settings.flex)) * 2, 0, 12);
    const constructionScore = clamp(starterAverage * 0.62 + 36 + depthBonus - completionPenalty - surplusPenalty, 15, 99);

    const earlyQB = picks.filter(entry => normalizePosition(entry.player.pos || entry.player.position) === 'QB' && entry.pick <= settings.teams * 2 && (playerRank(entry.player) ?? entry.pick) > entry.pick + 4).length;
    const earlySpecialists = picks.filter(entry => ['K', 'DST'].includes(normalizePosition(entry.player.pos || entry.player.position)) && entry.pick <= settings.teams * 12).length;
    const eliteTimed = picks.filter(entry => CORE_POSITIONS.includes(normalizePosition(entry.player.pos || entry.player.position)) && ['S', 'A'].includes(String(entry.player.overallTier || entry.player.tier || '').toUpperCase()) && entry.pick >= (playerRank(entry.player) ?? entry.pick) - 4).length;
    const positionalTimingScore = clamp(72 + eliteTimed * 1.8 + Math.min(10, positiveValues.length) - earlyQB * 12 - earlySpecialists * 9 - reaches.length * 1.8 - missing.length * 5, 20, 99);

    const risky = players.filter(player => String(player.ambiguity || '').toLowerCase() === 'high' || String(player.availabilityRisk || '').toLowerCase() === 'high');
    const rookies = players.filter(player => player.rookie);
    const fragileConcentration = Math.max(0, risky.length - 2) + Math.max(0, rookies.length - 5);
    const stable = players.filter(player => String(player.roleSecurity || '').toLowerCase() === 'high' || player.workhorse);
    const riskScore = clamp(82 + Math.min(8, stable.length * 1.5) - risky.length * 7 - fragileConcentration * 3 - missing.length * 2, 20, 98);

    const benchCore = lineup.bench.filter(player => CORE_POSITIONS.includes(normalizePosition(player.pos || player.position)));
    const upsideBench = benchCore.filter(player => player.rookie || player.leagueBreaker || player.coreTarget || ['S', 'A'].includes(String(player.overallTier || player.tier || '').toUpperCase()));
    const specialistBench = lineup.bench.filter(player => ['K', 'DST'].includes(normalizePosition(player.pos || player.position))).length;
    const benchAverage = benchCore.length ? benchCore.reduce((sum, player) => sum + playerStrength(player), 0) / benchCore.length : 35;
    const benchUpsideScore = clamp(45 + benchAverage * 0.36 + upsideBench.length * 4 - specialistBench * 8 - Math.max(0, counts.QB - 2) * 5, 20, 99);

    const halfPprCore = counts.RB + counts.WR;
    const flexibleDepth = Math.max(0, halfPprCore - settings.startRB - settings.startWR);
    const leagueFitScore = clamp(78 + Math.min(10, flexibleDepth * 2) - missing.length * 7 - surplusPenalty * 0.8 - invalidSize * 5 - (settings.teams <= 10 ? Math.max(0, counts.QB - 2) * 4 : 0), 15, 99);

    const categories = Object.freeze({
      draftValue: category(draftValueScore, valueCoverage < 0.7 ? `Only ${rankedPicks.length} of ${players.length} picks had trustworthy overall-rank context.` : averageDelta >= 3 ? `The roster captured an average of ${round(averageDelta, 1)} picks of market value.` : averageDelta <= -3 ? `The roster paid an average premium of ${round(Math.abs(averageDelta), 1)} picks versus stored overall rank.` : 'Selections stayed close to trustworthy overall market expectations.'),
      rosterConstruction: category(constructionScore, missing.length ? `Required starter coverage is incomplete at ${[...new Set(missing)].join(', ')}.` : surplusPenalty ? 'The starting lineup is complete, but excess single-position depth reduced flexibility.' : 'The lineup is complete with functional core-position depth and flex coverage.'),
      positionalTiming: category(positionalTimingScore, earlyQB ? `${earlyQB} early one-QB selection was taken above its stored market price.` : earlySpecialists ? 'Kicker or defense was selected before the late-round value window.' : reaches.length ? `${reaches.length} selections came at least six picks ahead of stored market rank.` : 'Scarce positions were filled without a material timing reach.'),
      riskManagement: category(riskScore, risky.length ? `${risky.length} players carry high role or availability uncertainty.` : 'No player on the roster carries a high role or availability flag.'),
      benchUpside: category(benchUpsideScore, `${upsideBench.length} bench players have a documented breakout, rookie, core-target, or elite-tier path.`),
      leagueFit: category(leagueFitScore, missing.length ? 'The roster does not yet satisfy every configured starting requirement.' : surplusPenalty ? 'One-QB and single-specialist roster economics were weakened by redundant depth.' : `The roster fits a ${settings.teams}-team ${settings.scoring === 'half' ? 'half-PPR' : settings.scoring} league with ${settings.flex} flex spot${settings.flex === 1 ? '' : 's'}.`),
    });
    const weighted = Object.entries(CATEGORY_WEIGHTS).reduce((sum, [key, weight]) => sum + categories[key].score * weight, 0);
    const overallScore = round(clamp(weighted - Math.max(0, missing.length - 1) * 1.5, 10, 99), 1);

    const topStarters = lineup.starters.filter(player => CORE_POSITIONS.includes(normalizePosition(player.pos || player.position))).sort((a, b) => playerStrength(b) - playerStrength(a)).slice(0, 2);
    const weakPosition = ['RB', 'WR', 'QB', 'TE'].sort((a, b) => (counts[a] || 0) - (counts[b] || 0))[0];
    const strengths = [];
    if (topStarters.length >= 2) strengths.push(`${playerName(topStarters[0])} and ${playerName(topStarters[1])} form the roster's strongest weekly foundation.`);
    if (bestValue && bestValue.pick - playerRank(bestValue.player) >= 5) strengths.push(`${playerName(bestValue.player)} was selected ${round(bestValue.pick - playerRank(bestValue.player))} picks after stored overall rank.`);
    if (upsideBench.length) strengths.push(`${playerName(upsideBench[0])} gives the bench a documented upside path.`);
    if (!strengths.length) strengths.push(`The roster has playable depth across ${Object.entries(counts).filter(([, count]) => count).map(([position]) => position).join(', ')}.`);
    const weaknesses = [];
    if (missing.length) weaknesses.push(`The completed roster is missing required ${[...new Set(missing)].join(' and ')} coverage.`);
    if (counts.QB > 2) weaknesses.push(`${counts.QB} quarterbacks in a one-QB league reduced bench flexibility.`);
    if (counts.TE > Math.max(2, settings.startTE + 1)) weaknesses.push(`${counts.TE} tight ends created more depth than the configured lineup can normally use.`);
    if (counts.K > settings.startK || counts.DST > settings.startDST) weaknesses.push(`Extra ${counts.K > settings.startK ? 'kicker' : 'defense'} depth occupies a replaceable bench spot.`);
    if (risky.length >= 3) weaknesses.push(`${risky.slice(0, 2).map(playerName).join(' and ')} headline a ${risky.length}-player high-uncertainty group.`);
    const replaceableBench = [...lineup.bench].sort((a, b) => playerStrength(a) - playerStrength(b))[0];
    if (!weaknesses.length && replaceableBench) weaknesses.push(`${playerName(replaceableBench)} is the most replaceable bench piece.`);
    const improvements = [];
    if (missing.length) improvements.push(`Use the first available waiver or trade opportunity to secure a starting ${missing[0] === 'DST' ? 'D/ST' : missing[0]}.`);
    if (counts.QB > 2) improvements.push('Shop or release the third quarterback for RB/WR injury-away upside.');
    if (counts.K > settings.startK || counts.DST > settings.startDST) improvements.push(`Stream ${counts.DST > settings.startDST ? 'D/ST' : 'kicker'} rather than carrying two at a replaceable position.`);
    if (counts.RB < settings.startRB + settings.flex + 2) improvements.push(`${replaceableBench ? `Consider replacing ${playerName(replaceableBench)} with` : 'Prioritize'} early-season RB waiver upside rather than another low-ceiling specialist.`);
    if (counts.WR < settings.startWR + settings.flex + 2) improvements.push(`${replaceableBench ? `Use ${playerName(replaceableBench)}'s bench spot for` : 'Target'} an ascending WR role to strengthen weekly flex choices.`);
    if (!improvements.length) improvements.push(`Monitor waivers for a higher-upside replacement at ${weakPosition}; avoid sacrificing the strongest starters.`);

    return {
      teamId: team.teamId ?? team.team ?? team.id,
      managerName: String(team.managerName ?? team.name ?? `Team ${team.teamId ?? team.team ?? team.id}`),
      rosterSignature: players.map(playerKey).sort().join('|'),
      overallScore,
      referencePercentile: referencePercentile(overallScore),
      categories,
      strengths: Object.freeze(strengths.slice(0, 3)),
      weaknesses: Object.freeze(weaknesses.slice(0, 3)),
      improvements: Object.freeze(improvements.slice(0, 3)),
      debug: Object.freeze({ counts: Object.freeze(counts), missing: Object.freeze(missing), requiredRosterSize, actualRosterSize: players.length, starterAverage: round(starterAverage, 2), averageValueDelta: round(averageDelta, 2), valueCoverage: round(valueCoverage, 3), earlyQB, earlySpecialists, surplusPenalty, invalidSize }),
    };
  }

  function normalizedOdds(scored) {
    if (!scored.length) return [];
    const temperature = 17;
    const max = Math.max(...scored.map(team => team.overallScore));
    const weights = scored.map(team => Math.exp((team.overallScore - max) / temperature));
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    const odds = weights.map(value => round((value / total) * 100, 1));
    odds[0] = round(odds[0] + round(100 - odds.reduce((sum, value) => sum + value, 0), 1), 1);
    return odds;
  }

  function evaluateDraft(input = {}) {
    const settings = normalizedSettings(input.settings || input.league || {});
    const teams = (input.teams || []).map(team => evaluateRoster(team, input, settings));
    const scored = teams.slice().sort((a, b) => b.overallScore - a.overallScore || b.referencePercentile - a.referencePercentile || String(a.rosterSignature).localeCompare(String(b.rosterSignature)));
    const odds = normalizedOdds(scored);
    const reports = scored.map((team, index) => {
      const rank = index + 1;
      const rangeRadius = team.overallScore >= 92 ? 2 : 3;
      const low = Math.max(1, rank - rangeRadius);
      const high = Math.min(scored.length, rank + rangeRadius);
      const above = scored[index - 1];
      const below = scored[index + 1];
      const strongest = Object.entries(team.categories).sort((a, b) => b[1].score - a[1].score)[0];
      const weakest = Object.entries(team.categories).sort((a, b) => a[1].score - b[1].score)[0];
      const comparison = above
        ? `${round(above.overallScore - team.overallScore, 1)} points behind the next team; ${CATEGORY_LABELS[weakest[0]]} is the clearest separator.`
        : below ? `${round(team.overallScore - below.overallScore, 1)} points ahead of the next team, led by ${CATEGORY_LABELS[strongest[0]]}.` : 'No draft-room comparison is available.';
      return Object.freeze({
        ...team,
        rank,
        grade: gradeForPercentile(team.referencePercentile),
        championshipOdds: odds[index],
        projectedFinishRange: `${ordinal(low)}–${ordinal(high)}`,
        draftPercentile: team.referencePercentile,
        draftPercentileLabel: ordinal(team.referencePercentile),
        comparison,
        estimateLabel: 'Draft-day estimate, not a season guarantee',
      });
    });
    return Object.freeze({
      schemaVersion: 'fantasy-hq-draft-grade-1',
      settings,
      categoryWeights: CATEGORY_WEIGHTS,
      calibration: Object.freeze({ method: 'fixed logistic reference baseline', center: 74, scale: 6.5, aPlusPercentile: 98, championshipOddsTemperature: 17 }),
      teams: Object.freeze(reports),
      championshipOddsTotal: round(reports.reduce((sum, team) => sum + team.championshipOdds, 0), 1),
    });
  }

  function evaluateImportedDraft(record = {}, canonicalPlayers = []) {
    const picks = Array.isArray(record.picks) ? record.picks : [];
    const managerMap = record.managers || {};
    const teamIds = [...new Set(picks.map(pick => pick.teamSlot ?? pick.teamId ?? pick.team))];
    const teams = teamIds.map(teamId => ({
      teamId,
      managerName: managerMap[teamId] || managerMap[String(teamId)] || `Team ${teamId}`,
      playerIds: picks.filter(pick => String(pick.teamSlot ?? pick.teamId ?? pick.team) === String(teamId)).map(pick => pick.playerId ?? pick.id),
    }));
    const league = record.league || {};
    return evaluateDraft({
      teams,
      players: canonicalPlayers,
      picks: picks.map(pick => ({ overallPick: pick.overallPick ?? pick.pick, teamId: pick.teamSlot ?? pick.teamId ?? pick.team, playerId: pick.playerId ?? pick.id })),
      settings: {
        teams: league.teams,
        scoring: league.scoring,
        startQB: league.startQB,
        startRB: league.startRB,
        startWR: league.startWR ?? league.startingWR,
        startTE: league.startTE,
        flex: league.flex,
        startK: league.startK,
        startDST: league.startDST,
        bench: league.bench,
      },
    });
  }

  const api = Object.freeze({ CATEGORY_WEIGHTS, CATEGORY_LABELS, normalizePosition, normalizedSettings, assignLineup, referencePercentile, gradeForPercentile, evaluateDraft, evaluateImportedDraft });
  root.DraftGradingEngineV1 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
