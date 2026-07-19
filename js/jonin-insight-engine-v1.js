/**
 * Jonin Insight Engine V1
 * Explainability only: consumes existing scores and draft state without ranking players.
 */
const JoninInsightEngineV1 = (() => {
  'use strict';

  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
  const neutral = 'No meaningful signal is available yet.';
  const playerTier = player => String(player?.overallTier || player?.posTier || 'C').toUpperCase();
  const positionName = pos => pos === 'DST' ? 'D/ST' : (pos || 'position');
  const componentTotal = breakdown => ['projection', 'value', 'rosterFit', 'scarcity', 'risk']
    .reduce((sum, key) => sum + Number(breakdown?.[key] || 0), 0);

  function confidenceFor({player, candidates = [], breakdown = {}, tierDepth = 0, tierDrop = false}) {
    const top = Number(candidates[0]?.finalScore ?? breakdown.final ?? 0);
    const second = Number(candidates[1]?.finalScore ?? top);
    const separation = Math.max(0, top - second);
    let score = 58;
    const reasons = [];
    if (separation >= 8) { score += 18; reasons.push(`clear ${separation}-point lead`); }
    else if (separation >= 4) { score += 10; reasons.push(`${separation}-point lead`); }
    else if (candidates.length > 1) { score -= 18; reasons.push(`only ${separation} point${separation === 1 ? '' : 's'} separate the top options`); }
    if (breakdown.value > 0 && breakdown.rosterFit > 0) { score += 10; reasons.push('value and roster fit agree'); }
    if (breakdown.value > 0 && breakdown.rosterFit < 0) { score -= 10; reasons.push('value conflicts with roster fit'); }
    if (tierDrop || tierDepth <= 2) { score += 8; reasons.push('a meaningful tier drop follows'); }
    const missing = ['name', 'pos', 'team'].filter(key => !player?.[key]).length +
      (player?.overall == null && !player?.overallTier && !player?.posTier ? 1 : 0);
    if (missing) { score -= missing * 8; reasons.push('player data is incomplete'); }
    const modifiers = ['value', 'rosterFit', 'scarcity', 'risk'].map(key => Math.abs(Number(breakdown[key] || 0)));
    const modifierSum = modifiers.reduce((sum, value) => sum + value, 0);
    if (modifierSum >= 6 && Math.max(...modifiers) / modifierSum >= .72) {
      score -= 8; reasons.push('one modifier drives most of the edge');
    }
    score = clamp(score);
    const label = score >= 82 ? 'High confidence' : score >= 62 ? 'Solid confidence' : score >= 42 ? 'Close call' : 'Low confidence';
    return {score, label, reason: reasons.slice(0, 2).join('; ') || 'Signals are reasonably aligned.'};
  }

  function opportunityWindow({player, availablePlayers = [], picksUntil = 0, candidates = []}) {
    const tier = playerTier(player);
    const samePosition = availablePlayers.filter(item => item.id !== player?.id && item.pos === player?.pos);
    const sameTier = samePosition.filter(item => playerTier(item) === tier);
    const nearby = samePosition.filter(item => {
      const a = Number(player?.overall);
      const b = Number(item?.overall);
      return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(6, picksUntil);
    });
    const scoreGap = Math.max(0, Number(candidates[0]?.finalScore || 0) - Number(candidates[1]?.finalScore || 0));
    const tierDrop = sameTier.length === 0 && ['S', 'A', 'B'].includes(tier);
    let label;
    if (tierDrop || (sameTier.length <= 1 && picksUntil >= 5 && scoreGap >= 4)) label = 'Draft now';
    else if (sameTier.length <= 2 || nearby.length <= 2 || picksUntil >= 7) label = 'Risky to wait';
    else label = 'Probably safe to wait';
    const reason = `${sameTier.length} other ${tier}-tier ${positionName(player?.pos)} option${sameTier.length === 1 ? '' : 's'} ${sameTier.length === 1 ? 'remains' : 'remain'}; ${picksUntil} pick${picksUntil === 1 ? '' : 's'} until you select again${nearby.length ? `, with ${nearby.length} nearby-ranked alternative${nearby.length === 1 ? '' : 's'}` : ''}.`;
    return {label, reason, tierDepth: sameTier.length, nearbyDepth: nearby.length, tierDrop};
  }

  function whyNot({recommended, candidates = []}) {
    const alternative = candidates.find(item => item.player?.id !== recommended?.id);
    if (!alternative) return {alternative: null, preferred: neutral, stronger: neutral, weaker: neutral, scoreDifference: 0};
    const primary = candidates.find(item => item.player?.id === recommended?.id) || candidates[0];
    const dimensions = [
      ['value', 'value'], ['rosterFit', 'team fit'], ['scarcity', 'scarcity'], ['projection', 'projection']
    ];
    const stronger = dimensions.filter(([key]) => Number(alternative.breakdown?.[key] || 0) > Number(primary?.breakdown?.[key] || 0)).map(([, label]) => label);
    const weaker = dimensions.filter(([key]) => Number(alternative.breakdown?.[key] || 0) < Number(primary?.breakdown?.[key] || 0)).map(([, label]) => label);
    const difference = Number(primary?.finalScore || 0) - Number(alternative.finalScore || 0);
    return {
      alternative: alternative.player,
      preferred: difference > 0 ? `${recommended.name} leads the existing final-pick score by ${difference}.` : `${recommended.name} wins the current recommendation tie-breakers.`,
      stronger: stronger.length ? `${alternative.player.name} is stronger in ${stronger.slice(0, 2).join(' and ')}.` : `${alternative.player.name} has no clear component advantage.`,
      weaker: weaker.length ? `${alternative.player.name} trails in ${weaker.slice(0, 2).join(' and ')}.` : 'The alternatives are effectively even across visible components.',
      scoreDifference: difference
    };
  }

  function buildRecommendationInsight(input) {
    const {player, candidates = [], availablePlayers = [], counts = {}, positionStrength = 'Unknown', picksUntil = 0, breakdown = {}} = input;
    const window = opportunityWindow({player, availablePlayers, picksUntil, candidates});
    const confidence = confidenceFor({player, candidates, breakdown, tierDepth: window.tierDepth, tierDrop: window.tierDrop});
    const positionCount = Number(counts[player?.pos] || 0);
    const rank = Number(player?.overall);
    const pick = Number(input.pick || 0);
    const fall = Number.isFinite(rank) ? Math.max(0, pick - rank) : 0;
    const riskSignal = Number(input.survivalRisk || 0);
    const sections = {
      value: fall > 0 ? `Available ${fall} pick${fall === 1 ? '' : 's'} after overall rank ${rank}; existing value modifiers add ${Number(breakdown.value || 0)}.` : Number.isFinite(rank) ? `Ranked ${rank} overall and currently leads the existing final-pick score.` : 'Unranked in the canonical board; analyst and tier signals drive this recommendation.',
      teamFit: Number(breakdown.rosterFit || 0) > 0 ? `${positionName(player?.pos)} is ${String(positionStrength).toLowerCase()} on your roster; fit adds ${breakdown.rosterFit}.` : Number(breakdown.rosterFit || 0) < 0 ? `You already have ${positionCount} ${positionName(player?.pos)}; roster balance subtracts ${Math.abs(breakdown.rosterFit)}.` : `Roster fit is neutral with ${positionCount} ${positionName(player?.pos)} currently rostered.`,
      scarcity: window.reason,
      risk: riskSignal > 0 ? `${riskSignal}/95 current survival-risk signal before your next turn${player?.availabilityRisk === 'high' ? '; availability risk is also flagged high' : ''}.` : player?.availabilityRisk === 'high' ? 'Availability risk is flagged high; the room-survival signal is otherwise neutral.' : 'No material availability or room-survival warning is active.',
      confidence: `${confidence.label}: ${confidence.reason}`
    };
    Object.keys(sections).forEach(key => { if (!String(sections[key] || '').trim()) sections[key] = neutral; });
    return {
      sections,
      confidence,
      breakdown: {...breakdown, reconciles: componentTotal(breakdown) === Number(breakdown.final)},
      whyNot: whyNot({recommended: player, candidates}),
      opportunityWindow: window
    };
  }

  function explainDraftGrade(evaluation, context = {}) {
    const counts = context.counts || {};
    const starters = Number(context.starterCount || 0);
    const bench = Number(context.benchCount || 0);
    const ceilingPlayers = Number(context.ceilingPlayers || 0);
    const upsideBench = Number(context.upsideBench || 0);
    const best = evaluation.bestPick;
    const bestDelta = Number(context.bestValueDelta || 0);
    const explanations = {
      starters: `${evaluation.starterStrength}: ${starters} starter slots evaluated from average starter rank${context.missingStarterPositions?.length ? `; missing ${context.missingStarterPositions.join(', ')}` : ' with every required position represented'}.`,
      ceiling: `${evaluation.ceiling}: ${ceilingPlayers} S/A-tier or analyst-boosted skill player${ceilingPlayers === 1 ? '' : 's'}${counts.RB >= 4 || counts.WR >= 5 ? ', plus premium RB/WR depth' : ''}.`,
      value: `${evaluation.value}: roster-wide average draft rank produced this value grade across ${context.playerCount || 0} selections.`,
      construction: `${evaluation.construction}: ${context.constructionNotes?.length ? context.constructionNotes.join('; ') : 'all required positions filled without duplicate specialist penalties'}.`,
      benchUpside: `${evaluation.benchUpside}: ${upsideBench} of ${bench} bench player${bench === 1 ? '' : 's'} carry rookie, A-tier, or analyst-boost upside.`,
      bestValue: best ? `${best.name}, selected ${bestDelta > 0 ? `${bestDelta} picks after` : bestDelta < 0 ? `${Math.abs(bestDelta)} picks before` : 'at'} his board rank.` : 'No ranked selection was available for a best-value comparison.',
      projectedFinish: `#${evaluation.rank} of ${context.teamCount || 10}: the ${evaluation.score}/100 composite ranks against every completed roster in this draft.`
    };
    Object.keys(explanations).forEach(key => { if (!String(explanations[key] || '').trim()) explanations[key] = neutral; });
    return explanations;
  }

  return {buildRecommendationInsight, confidenceFor, opportunityWindow, whyNot, explainDraftGrade, componentTotal, NEUTRAL: neutral};
})();

if (typeof window !== 'undefined') window.JoninInsightEngineV1 = JoninInsightEngineV1;
